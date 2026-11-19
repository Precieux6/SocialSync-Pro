// socialsync-pro-backend/src/services/publishers/instagram.js
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const VIDEO_FORMATS = ['Vidéo courte'];
const IMAGE_FORMATS = ['Photo'];

async function graph(method, path, { token, params = {} } = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  const init = {
    method,
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  };

  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  } else {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(params);
  }

  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`Instagram : ${json.error?.message || `erreur ${res.status}`}`);
  }
  return json;
}

function buildCaption(post) {
  const tags = (post.tags || []).map((t) => (t.startsWith('#') ? t : `#${t.replace(/^@/, '')}`));
  return [post.caption.trim(), tags.join(' ')].filter(Boolean).join('\n\n');
}

// Meta doit avoir fini de traiter la vidéo avant publication (environ 60 secondes au maximum ici)
async function waitUntilReady(containerId, token) {
  for (let i = 0; i < 12; i++) {
    const { status_code: status } = await graph('GET', containerId, {
      token,
      params: { fields: 'status_code' },
    });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram : traitement du média ${String(status).toLowerCase()}.`);
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error('Instagram : délai de traitement de la vidéo dépassé.');
}

// Retourne { externalId, warning }. Le premier commentaire n'annule jamais une publication réussie.
export async function publishInstagram(post, { accountId, accessToken }) {
  if (!accountId || !accessToken) throw new Error('Instagram : identifiants incomplets.');
  const token = accessToken;
  const caption = buildCaption(post);
  const media = post.media_urls || [];

  let creation;

  if (VIDEO_FORMATS.includes(post.format)) {
    if (!post.video_url) throw new Error('Instagram : aucune vidéo associée.');
    creation = await graph('POST', `${accountId}/media`, {
      token,
      params: { media_type: 'REELS', video_url: post.video_url, caption },
    });
    await waitUntilReady(creation.id, token);
  } else if (post.format === 'Carrousel') {
    if (media.length < 2) throw new Error('Instagram : un carrousel demande au moins 2 images.');
    const children = [];
    for (const url of media.slice(0, 10)) {
      const child = await graph('POST', `${accountId}/media`, {
        token,
        params: { image_url: url, is_carousel_item: 'true' },
      });
      children.push(child.id);
    }
    creation = await graph('POST', `${accountId}/media`, {
      token,
      params: { media_type: 'CAROUSEL', children: children.join(','), caption },
    });
  } else if (IMAGE_FORMATS.includes(post.format)) {
    if (media.length === 0) throw new Error('Instagram : aucune image associée.');
    creation = await graph('POST', `${accountId}/media`, {
      token,
      params: { image_url: media[0], caption },
    });
  } else {
    throw new Error(`Instagram : le format « ${post.format} » n'est pas pris en charge par l'API.`);
  }

  const published = await graph('POST', `${accountId}/media_publish`, {
    token,
    params: { creation_id: creation.id },
  });

  let warning = null;
  if (post.first_comment?.trim()) {
    try {
      await graph('POST', `${published.id}/comments`, {
        token,
        params: { message: post.first_comment.trim() },
      });
    } catch (err) {
      warning = `Post publié, premier commentaire non ajouté : ${err.message}`;
    }
  }

  return { externalId: published.id, warning };
}

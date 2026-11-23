// socialsync-pro-backend/src/services/publishers/instagram.js
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const VIDEO_FORMATS = ['Vidéo courte'];
const IMAGE_FORMATS = ['Photo'];
const CAROUSEL_FORMATS = ['Carrousel'];

const CAPTION_MAX = 2200;        // limite Instagram, légende et tags compris
const TAGS_MAX = 500;            // part maximale de la légende réservée aux tags
const CAROUSEL_MIN_ITEMS = 2;
const CAROUSEL_MAX_ITEMS = 10;
const REQUEST_TIMEOUT_MS = 30_000;
const READ_RETRIES = 2;          // lectures et création de conteneurs : sans risque de doublon
const VIDEO_WAIT_MS = Number(process.env.IG_VIDEO_WAIT_MS) || 120_000;
const VIDEO_POLL_MS = 5_000;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const HTTPS_RE = /^https:\/\//;

// Erreur Instagram. Champs utiles à l'appelant :
// - retryable : l'erreur est transitoire, une nouvelle tentative peut réussir ;
// - ambiguous : la publication a peut-être abouti côté Meta, ne pas relancer sans vérification ;
// - creationId : identifiant du conteneur, pour retrouver le média sur Meta si besoin.
export class InstagramError extends Error {
  constructor(message, { retryable = false, ambiguous = false, creationId = null } = {}) {
    super(`Instagram : ${message}`);
    this.name = 'InstagramError';
    this.retryable = retryable;
    this.ambiguous = ambiguous;
    this.creationId = creationId;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (attempt) => 1_000 * 2 ** (attempt - 1);

async function graph(method, path, { token, params = {}, retries = 0 } = {}) {
  let attempt = 0;

  for (;;) {
    attempt += 1;
    const url = new URL(`${GRAPH}/${path}`);
    const init = {
      method,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    if (method === 'GET') {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    } else {
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      );
    }

    let res;
    let json;
    try {
      res = await fetch(url, init);
      json = await res.json().catch(() => ({}));
    } catch (err) {
      if (attempt <= retries) {
        await sleep(backoff(attempt));
        continue;
      }
      const reason = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'délai dépassé'
        : err.message;
      throw new InstagramError(`réseau injoignable (${reason}).`, { retryable: true });
    }

    if (!res.ok || json.error) {
      const retryable = RETRY_STATUS.has(res.status) || json.error?.is_transient === true;
      if (retryable && attempt <= retries) {
        await sleep(backoff(attempt));
        continue;
      }
      throw new InstagramError(json.error?.message || `erreur ${res.status}`, { retryable });
    }
    return json;
  }
}

// Tags : sans @ ni #, sans espaces, dédoublonnés, dans la limite TAGS_MAX.
// Les « @ » sont convertis en hashtags, comme dans les versions précédentes.
function buildTagLine(tags) {
  const list = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const word = String(raw ?? '').trim().replace(/^[@#]+/, '').replace(/\s+/g, '');
    if (!word) continue;
    const tag = `#${word}`;
    if (!list.includes(tag)) list.push(tag);
  }

  const kept = [];
  let used = 0;
  for (const tag of list) {
    const len = Array.from(tag).length + (kept.length ? 1 : 0);
    if (used + len > TAGS_MAX) break;
    used += len;
    kept.push(tag);
  }
  return kept.join(' ');
}

// Légende complète, toujours dans la limite de 2 200 caractères
function buildCaption(post) {
  const tagLine = buildTagLine(post.tags);
  const separator = tagLine ? '\n\n' : '';
  const room = CAPTION_MAX - Array.from(separator + tagLine).length;
  const body = Array.from(String(post.caption ?? '').trim())
    .slice(0, Math.max(0, room))
    .join('')
    .trimEnd();
  return [body, tagLine].filter(Boolean).join('\n\n');
}

// Meta doit avoir fini de traiter la vidéo avant publication
async function waitUntilReady(containerId, token) {
  const deadline = Date.now() + VIDEO_WAIT_MS;

  while (Date.now() < deadline) {
    const { status_code: status } = await graph('GET', containerId, {
      token,
      params: { fields: 'status_code' },
      retries: READ_RETRIES,
    });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new InstagramError(`traitement du média ${String(status).toLowerCase()}.`);
    }
    await sleep(VIDEO_POLL_MS);
  }
  throw new InstagramError('délai de traitement de la vidéo dépassé.', { retryable: true });
}

// Retourne { externalId, warning }. Un échec du premier commentaire n'annule jamais une publication réussie.
export async function publishInstagram(post, { accountId, accessToken } = {}) {
  if (!accountId || !accessToken) throw new InstagramError('identifiants incomplets.');

  const token = accessToken;
  const format = post.format;
  const caption = buildCaption(post);
  const media = (Array.isArray(post.media_urls) ? post.media_urls : [])
    .map((u) => String(u))
    .filter((u) => HTTPS_RE.test(u));

  if (!caption) throw new InstagramError('légende vide.');

  let creation;

  if (VIDEO_FORMATS.includes(format)) {
    if (!post.video_url || !HTTPS_RE.test(post.video_url)) {
      throw new InstagramError('aucune vidéo associée (URL https requise).');
    }
    creation = await graph('POST', `${accountId}/media`, {
      token,
      retries: READ_RETRIES,
      params: { media_type: 'REELS', video_url: post.video_url, caption },
    });
    await waitUntilReady(creation.id, token);
  } else if (CAROUSEL_FORMATS.includes(format)) {
    if (media.length < CAROUSEL_MIN_ITEMS) {
      throw new InstagramError(`un carrousel demande au moins ${CAROUSEL_MIN_ITEMS} images (https).`);
    }
    const children = [];
    for (const url of media.slice(0, CAROUSEL_MAX_ITEMS)) {
      const child = await graph('POST', `${accountId}/media`, {
        token,
        retries: READ_RETRIES,
        params: { image_url: url, is_carousel_item: 'true' },
      });
      children.push(child.id);
    }
    creation = await graph('POST', `${accountId}/media`, {
      token,
      retries: READ_RETRIES,
      params: { media_type: 'CAROUSEL', children: children.join(','), caption },
    });
  } else if (IMAGE_FORMATS.includes(format)) {
    if (!media.length) throw new InstagramError('aucune image associée (URL https requise).');
    creation = await graph('POST', `${accountId}/media`, {
      token,
      retries: READ_RETRIES,
      params: { image_url: media[0], caption },
    });
  } else {
    throw new InstagramError(`le format « ${format} » n'est pas pris en charge par l'API.`);
  }

  // Aucune relance automatique ici : une seconde publication créerait un doublon.
  let published;
  try {
    published = await graph('POST', `${accountId}/media_publish`, {
      token,
      params: { creation_id: creation.id },
    });
  } catch (err) {
    // Erreur réseau ou 5xx : la publication a peut-être abouti. Erreur 4xx : elle n'a pas abouti.
    err.ambiguous = err.retryable === true;
    err.creationId = creation.id;
    throw err;
  }

  if (!published?.id) {
    throw new InstagramError('publication sans identifiant de retour.', {
      ambiguous: true,
      creationId: creation.id,
    });
  }

  let warning = null;
  const firstComment = Array.from(String(post.first_comment ?? '').trim()).slice(0, 2200).join('');
  if (firstComment) {
    try {
      await graph('POST', `${published.id}/comments`, {
        token,
        params: { message: firstComment },
      });
    } catch (err) {
      warning = `Post publié, premier commentaire non ajouté : ${err.message}`;
    }
  }

  return { externalId: published.id, warning };
}

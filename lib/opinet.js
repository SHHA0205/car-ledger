const { XMLParser } = require('fast-xml-parser');

const OPINET_BASE = 'https://www.opinet.co.kr/api';
const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
});

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeOpinetData(raw) {
  if (!raw) return { RESULT: { OIL: [] } };

  if (raw.RESULT) {
    const oil = raw.RESULT.OIL;
    return {
      RESULT: {
        OIL: ensureArray(oil),
      },
    };
  }

  if (raw.OIL) {
    return { RESULT: { OIL: ensureArray(raw.OIL) } };
  }

  return { RESULT: { OIL: [] } };
}

function parseOpinetBody(text, requestedFormat) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { RESULT: { OIL: [] } };

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return normalizeOpinetData(JSON.parse(trimmed));
    } catch {
      /* fall through to XML */
    }
  }

  if (trimmed.startsWith('<')) {
    const parsed = parser.parse(trimmed);
    return normalizeOpinetData(parsed);
  }

  if (requestedFormat === 'json') {
    throw new Error('오피넷 응답을 해석할 수 없습니다.');
  }

  return { RESULT: { OIL: [] } };
}

async function fetchOpinet(endpoint, params) {
  const url = new URL(`${OPINET_BASE}/${endpoint}.do`);
  const out = params.out || 'xml';

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set('out', out);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json, application/xml, text/xml, */*' },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`오피넷 API 오류 (${response.status})`);
  }

  if (text.includes('ERR') || text.includes('인증키') || text.includes('CERTKEY')) {
    const msg = text.includes('인증키') ? '오피넷 API 인증키가 올바르지 않습니다.' : '오피넷 API 요청이 거부되었습니다.';
    throw new Error(msg);
  }

  return parseOpinetBody(text, out);
}

module.exports = { fetchOpinet, normalizeOpinetData };
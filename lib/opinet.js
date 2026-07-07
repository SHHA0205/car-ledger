const { XMLParser } = require('fast-xml-parser');

const OPINET_BASE = 'https://www.opinet.co.kr/api';
const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  isArray: (name) => name === 'OIL' || name === 'OIL_PRICE',
});

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isAuthFailure(raw) {
  if (!raw?.RESULT) return true;
  if (raw.RESULT.ERR || raw.RESULT.CODE) return false;
  const oil = raw.RESULT.OIL;
  // 잘못된 키: <RESULT></RESULT> → OIL 필드 없음
  // 정상 키·결과 없음: OIL: [] 배열
  if (Array.isArray(oil)) return false;
  return oil === undefined || oil === null;
}

function normalizeOpinetData(raw) {
  if (!raw) {
    throw new Error('오피넷 API 인증키가 올바르지 않습니다. 설정 또는 Render OPINET_API_KEY를 확인하세요.');
  }

  if (raw.RESULT) {
    if (raw.RESULT.ERR || raw.RESULT.CODE) {
      const msg = raw.RESULT.ERR || raw.RESULT.MSG || '오피넷 API 오류';
      throw new Error(String(msg).includes('인증') ? '오피넷 API 인증키가 올바르지 않습니다.' : String(msg));
    }
    if (isAuthFailure(raw)) {
      throw new Error('오피넷 API 인증키가 올바르지 않습니다. 설정 또는 Render OPINET_API_KEY를 확인하세요.');
    }
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

  throw new Error('오피넷 API 인증키가 올바르지 않습니다. 설정 또는 Render OPINET_API_KEY를 확인하세요.');
}

function parseOpinetBody(text, requestedFormat) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    throw new Error('오피넷 API 인증키가 올바르지 않습니다. 설정 또는 Render OPINET_API_KEY를 확인하세요.');
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return normalizeOpinetData(JSON.parse(trimmed));
    } catch {
      /* fall through to XML */
    }
  }

  if (trimmed.startsWith('<')) {
    try {
      const parsed = parser.parse(trimmed);
      return normalizeOpinetData(parsed);
    } catch (err) {
      throw new Error(err.message || '오피넷 XML 파싱 실패');
    }
  }

  if (requestedFormat === 'json') {
    throw new Error('오피넷 응답을 해석할 수 없습니다.');
  }

  throw new Error('오피넷 API 인증키가 올바르지 않습니다. 설정 또는 Render OPINET_API_KEY를 확인하세요.');
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
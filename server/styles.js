// The one visual style: illustrated 2D explainer animation. `tokens` become CSS variables in every scene (--bg, --primary, ...);
// `guide` is the art-direction brief handed to the art director.
export const STYLES = {
  cartoon: {
    name: 'Hoạt hình 2D minh họa',
    desc: 'Phim hoạt hình giải thích: mỗi cảnh là một cảnh quay minh họa sống động trong bối cảnh vẽ chi tiết, nhân vật hành động, máy quay chuyển động',
    cartoon: true,
    ambient: 'none',
    tokens: {
      bg: '#fdf6ec', bg2: '#f3e9da', surface: '#ffffff', surface2: '#f4ebdd', line: 'rgba(60,45,30,.14)',
      text: '#2b2118', muted: '#7d6c5c', primary: '#3b7cf6', accent: '#ff7a45', accent2: '#2fb38a', danger: '#e5484d', success: '#2fb38a',
      fontDisplay: "'Be Vietnam Pro', sans-serif", fontBody: "'Be Vietnam Pro', sans-serif", fontMono: "'JetBrains Mono Variable', monospace",
      radius: '24px',
    },
    guide: 'Phim hoạt hình 2D phẳng kiểu Kurzgesagt / TED-Ed: mỗi cảnh là một cảnh quay trong một thế giới được vẽ đầy đủ (phố, chợ, ruộng, nhà máy, đại dương, vũ trụ, trong cơ thể...), sự vật được minh họa đúng như thật và chuyển động, máy quay đẩy/lia, chữ rất ít.',
  },
};

export const CATEGORIES = {
  science: 'Khoa học',
  economics: 'Kinh tế',
  politics: 'Chính trị & Xã hội',
  history: 'Lịch sử',
  space: 'Vũ trụ',
  technology: 'Công nghệ',
  other: 'Kiến thức khác',
};

export const TONES = {
  story: 'Kể chuyện cuốn hút, có nhân vật/tình huống, mở nút thắt dần',
  explainer: 'Giải thích rõ ràng từng bước, logic chặt chẽ, nhiều ví dụ đời thường',
  analysis: 'Phân tích sâu, đa chiều, nêu số liệu và lập luận của các bên',
  casual: 'Gần gũi, hài hước nhẹ, như trò chuyện với bạn bè',
};

// GPT-6 Astra is used by content, not by a user-picked tier: one art-direction call per video, then only the drawings the
// art director judges necessary (at most this many new ones; reuse from the library is free).
export const ASTRA_MAX_NEW_DRAWINGS = 6;

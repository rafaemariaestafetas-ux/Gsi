// Papéis de parede SVG exclusivos para cada tema do chat GSI PRO
// 1. Clássico: mantém o padrão original estilo WhatsApp doodle
// 2. Dark Premium: doodle luxo escuro com capacetes de obra, réguas, bússolas e engrenagens em linhas douradas elegantes (#d4af37)
// 3. Industrial: padrão técnico de obra com grelhas de engenharia, vigas de aço, guindastes e ferramentas técnicas
// 4. Noite Suave: constelações cósmicas calmas, estrelas náuticas, bússolas sutis e malha geométrica calma em azul profundo

const encodeSvgToDataUri = (svgString: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
};

// 2. DARK PREMIUM WALLPAPER: Linhas de ouro com elementos de construção/engenharia de alta precisão
const darkPremiumSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380" viewBox="0 0 380 380" fill="none">
  <!-- Grid isométrica de fundo suave -->
  <defs>
    <linearGradient id="goldGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#f5df7a" stop-opacity="0.4"/>
    </linearGradient>
  </defs>

  <!-- Padrão sutil de pontos dourados -->
  <circle cx="20" cy="20" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="190" cy="20" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="360" cy="20" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="20" cy="190" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="190" cy="190" r="1.5" fill="#d4af37" opacity="0.4"/>
  <circle cx="360" cy="190" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="20" cy="360" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="190" cy="360" r="1" fill="#d4af37" opacity="0.3"/>
  <circle cx="360" cy="360" r="1" fill="#d4af37" opacity="0.3"/>

  <!-- Capacete de Engenharia GSI Pro (top left) -->
  <g transform="translate(45, 50)" stroke="#d4af37" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.75">
    <path d="M5 25 C5 10 20 2 35 2 C50 2 65 10 65 25 Z"/>
    <path d="M0 25 C0 23 10 23 35 23 C60 23 70 23 70 25 C70 27 60 27 35 27 C10 27 0 27 0 25 Z"/>
    <path d="M25 8 L25 2"/>
    <path d="M45 8 L45 2"/>
    <circle cx="35" cy="13" r="3" fill="#d4af37" fill-opacity="0.2"/>
  </g>

  <!-- Bússola Náutica e Rosa dos Ventos Dourada (top right) -->
  <g transform="translate(265, 45)" stroke="#d4af37" stroke-width="1.5" fill="none" opacity="0.8">
    <circle cx="30" cy="30" r="24" stroke-dasharray="3 3"/>
    <circle cx="30" cy="30" r="28" stroke-width="0.8" opacity="0.5"/>
    <polygon points="30,8 35,26 30,30 25,26" fill="#d4af37" fill-opacity="0.6"/>
    <polygon points="30,52 35,34 30,30 25,34" fill="#d4af37" fill-opacity="0.3"/>
    <polygon points="52,30 34,35 30,30 34,25" fill="#d4af37" fill-opacity="0.4"/>
    <polygon points="8,30 26,35 30,30 26,25" fill="#d4af37" fill-opacity="0.4"/>
    <circle cx="30" cy="30" r="2" fill="#d4af37"/>
  </g>

  <!-- Esquadro e Régua de Arquiteto (center left) -->
  <g transform="translate(40, 230)" stroke="#d4af37" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.75">
    <polygon points="5,5 5,65 65,65" stroke-width="2"/>
    <polygon points="18,28 18,52 42,52" fill="#d4af37" fill-opacity="0.15"/>
    <!-- Marcações de régua -->
    <line x1="5" y1="15" x2="11" y2="15"/>
    <line x1="5" y1="25" x2="14" y2="25"/>
    <line x1="5" y1="35" x2="11" y2="35"/>
    <line x1="5" y1="45" x2="14" y2="45"/>
    <line x1="5" y1="55" x2="11" y2="55"/>
    <line x1="25" y1="65" x2="25" y2="59"/>
    <line x1="35" y1="65" x2="35" y2="56"/>
    <line x1="45" y1="65" x2="45" y2="59"/>
    <line x1="55" y1="65" x2="55" y2="56"/>
  </g>

  <!-- Relógio de Ponto e Engrenagem Dourada (center) -->
  <g transform="translate(160, 150)" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.8">
    <circle cx="30" cy="30" r="22" stroke-width="2"/>
    <circle cx="30" cy="30" r="26" stroke-dasharray="2 4" stroke-width="0.8" opacity="0.6"/>
    <polyline points="30,16 30,30 40,30" stroke-width="2"/>
    <circle cx="30" cy="30" r="2.5" fill="#d4af37"/>
    <!-- Dentes da engrenagem externa -->
    <path d="M30 3 L30 8 M30 52 L30 57 M3 30 L8 30 M52 30 L57 30 M11 11 L15 15 M45 45 L49 49 M11 49 L15 45 M45 11 L49 15" stroke-width="1.8"/>
  </g>

  <!-- Edifício / Estrutura de Obra em Geometria Fina (center right) -->
  <g transform="translate(280, 210)" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.75">
    <rect x="10" y="5" width="38" height="60" rx="3" stroke-width="1.8"/>
    <!-- Janelas simétricas -->
    <line x1="20" y1="15" x2="26" y2="15"/>
    <line x1="32" y1="15" x2="38" y2="15"/>
    <line x1="20" y1="28" x2="26" y2="28"/>
    <line x1="32" y1="28" x2="38" y2="28"/>
    <line x1="20" y1="41" x2="26" y2="41"/>
    <line x1="32" y1="41" x2="38" y2="41"/>
    <rect x="23" y="52" width="12" height="13" fill="#d4af37" fill-opacity="0.2"/>
  </g>

  <!-- Guindaste de Construção Minimalista (bottom) -->
  <g transform="translate(150, 300)" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7">
    <line x1="10" y1="55" x2="10" y2="5"/>
    <line x1="10" y1="10" x2="70" y2="10" stroke-width="2"/>
    <line x1="0" y1="10" x2="10" y2="10"/>
    <line x1="10" y1="5" x2="25" y2="10"/>
    <line x1="10" y1="5" x2="0" y2="10"/>
    <line x1="50" y1="10" x2="50" y2="35"/>
    <rect x="46" y="35" width="8" height="8" rx="1" fill="#d4af37" fill-opacity="0.25"/>
    <polyline points="0,55 10,55 20,55"/>
  </g>
</svg>`;

// 3. INDUSTRIAL WALLPAPER: Tons de cinza chumbo com grelha técnica de ferro, vigas H, rebites e ferramentas
const industrialSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360" fill="none">
  <!-- Malha de engenharia milimétrica -->
  <defs>
    <pattern id="indGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" stroke-width="0.5" stroke-opacity="0.25"/>
      <circle cx="0" cy="0" r="1.2" fill="#94a3b8" fill-opacity="0.3"/>
    </pattern>
  </defs>

  <rect width="360" height="360" fill="url(#indGrid)"/>

  <!-- Viga de Aço H (Structural Beam) top left -->
  <g transform="translate(40, 40)" stroke="#94a3b8" stroke-width="1.8" fill="none" opacity="0.8">
    <path d="M5 5 L55 5 M5 25 L55 25 M30 5 L30 25" stroke-width="2.2"/>
    <circle cx="12" cy="5" r="1.5" fill="#f59e0b" stroke="none"/>
    <circle cx="48" cy="5" r="1.5" fill="#f59e0b" stroke="none"/>
    <circle cx="12" cy="25" r="1.5" fill="#f59e0b" stroke="none"/>
    <circle cx="48" cy="25" r="1.5" fill="#f59e0b" stroke="none"/>
  </g>

  <!-- Chave Inglesa e Ferramenta de Obra (top right) -->
  <g transform="translate(250, 45)" stroke="#cbd5e1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.75">
    <path d="M12 18 L48 54 M20 10 L56 46" stroke-width="2"/>
    <path d="M10 22 C6 18 6 12 10 8 C14 4 20 4 24 8 L18 14 Z" fill="#64748b" fill-opacity="0.3"/>
    <circle cx="52" cy="50" r="3.5" fill="#f59e0b" fill-opacity="0.4"/>
  </g>

  <!-- Engrenagens Industriais Entrelaçadas (center) -->
  <g transform="translate(145, 145)" stroke="#cbd5e1" stroke-width="1.6" fill="none" opacity="0.8">
    <!-- Engrenagem Grande -->
    <circle cx="35" cy="35" r="22" stroke-width="2"/>
    <circle cx="35" cy="35" r="8" fill="#475569" fill-opacity="0.5"/>
    <path d="M35 8 L35 13 M35 57 L35 62 M8 35 L13 35 M57 35 L62 35 M16 16 L20 20 M50 50 L54 54 M16 54 L20 50 M50 20 L54 16" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- Nível de Bolha de Pedreiro (center left) -->
  <g transform="translate(35, 230)" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.75">
    <rect x="5" y="15" width="65" height="18" rx="4" stroke-width="2"/>
    <rect x="28" y="19" width="18" height="10" rx="3" fill="#f59e0b" fill-opacity="0.25"/>
    <circle cx="37" cy="24" r="2.5" fill="#f59e0b"/>
    <circle cx="12" cy="24" r="2" fill="#64748b"/>
    <circle cx="62" cy="24" r="2" fill="#64748b"/>
  </g>

  <!-- Martelo / Marreta de Construção (center right) -->
  <g transform="translate(260, 220)" stroke="#cbd5e1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.75">
    <rect x="25" y="8" width="30" height="16" rx="2" fill="#64748b" fill-opacity="0.3" stroke-width="2"/>
    <line x1="40" y1="24" x2="10" y2="60" stroke-width="2.4"/>
    <rect x="8" y="55" width="8" height="8" rx="2" fill="#f59e0b" fill-opacity="0.4"/>
  </g>

  <!-- Medidor Digital / Trena (bottom center) -->
  <g transform="translate(145, 280)" stroke="#94a3b8" stroke-width="1.6" fill="none" opacity="0.75">
    <circle cx="30" cy="30" r="20" stroke-width="2"/>
    <rect x="30" y="24" width="22" height="12" rx="2" fill="#f59e0b" fill-opacity="0.3" stroke="#f59e0b"/>
    <circle cx="30" cy="30" r="7" fill="#475569" fill-opacity="0.4"/>
    <line x1="52" y1="30" x2="68" y2="30" stroke-dasharray="2 2" stroke-width="2"/>
  </g>
</svg>`;

// 4. NOITE SUAVE WALLPAPER: Azul profundo com constelações serenas, estrelas calmas e nós astronômicos
const nightSoftSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380" viewBox="0 0 380 380" fill="none">
  <!-- Estrelas cintilantes sutis -->
  <circle cx="30" cy="40" r="1.5" fill="#38bdf8" opacity="0.7"/>
  <circle cx="120" cy="20" r="1" fill="#7dd3fc" opacity="0.5"/>
  <circle cx="320" cy="50" r="2" fill="#38bdf8" opacity="0.8"/>
  <circle cx="70" cy="150" r="1" fill="#93c5fd" opacity="0.4"/>
  <circle cx="210" cy="90" r="1.8" fill="#38bdf8" opacity="0.7"/>
  <circle cx="340" cy="180" r="1.2" fill="#7dd3fc" opacity="0.5"/>
  <circle cx="50" cy="310" r="1.5" fill="#38bdf8" opacity="0.6"/>
  <circle cx="180" cy="260" r="1" fill="#7dd3fc" opacity="0.4"/>
  <circle cx="330" cy="320" r="2" fill="#38bdf8" opacity="0.8"/>

  <!-- Lua Crescente e Estrela de 4 pontas (top left) -->
  <g transform="translate(50, 45)" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.8">
    <path d="M30 5 C16 5 5 16 5 30 C5 44 16 55 30 55 C22 47 22 13 30 5 Z" fill="#38bdf8" fill-opacity="0.2"/>
    <path d="M42 20 L44 26 L50 28 L44 30 L42 36 L40 30 L34 28 L40 26 Z" fill="#7dd3fc" stroke="none" opacity="0.9"/>
  </g>

  <!-- Constelação do Cruzeiro / Bússola do Céu (top right) -->
  <g transform="translate(250, 40)" stroke="#60a5fa" stroke-width="1.3" fill="none" opacity="0.75">
    <polyline points="25,10 40,25 65,30 50,55" stroke-dasharray="3 3"/>
    <circle cx="25" cy="10" r="3" fill="#38bdf8"/>
    <circle cx="40" cy="25" r="2.5" fill="#38bdf8"/>
    <circle cx="65" cy="30" r="3.5" fill="#7dd3fc"/>
    <circle cx="50" cy="55" r="3" fill="#38bdf8"/>
  </g>

  <!-- Mandala Astrológica Suave / Bússola Náutica Noturna (center) -->
  <g transform="translate(150, 150)" stroke="#38bdf8" stroke-width="1.4" fill="none" opacity="0.75">
    <circle cx="40" cy="40" r="32" stroke-dasharray="4 4"/>
    <circle cx="40" cy="40" r="26"/>
    <circle cx="40" cy="40" r="3" fill="#38bdf8"/>
    <polygon points="40,14 43,37 40,40 37,37" fill="#38bdf8" fill-opacity="0.7"/>
    <polygon points="40,66 43,43 40,40 37,43" fill="#38bdf8" fill-opacity="0.4"/>
    <polygon points="66,40 43,43 40,40 43,37" fill="#38bdf8" fill-opacity="0.5"/>
    <polygon points="14,40 37,43 40,40 37,37" fill="#38bdf8" fill-opacity="0.5"/>
  </g>

  <!-- Ondas Suaves Noturnas (center left) -->
  <g transform="translate(35, 230)" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7">
    <path d="M5 20 C15 12 25 28 35 20 C45 12 55 28 65 20"/>
    <path d="M5 32 C15 24 25 40 35 32 C45 24 55 40 65 32" opacity="0.6"/>
  </g>

  <!-- Orbe Cósmica e Anéis Planetários (center right) -->
  <g transform="translate(265, 215)" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.8">
    <circle cx="35" cy="35" r="16" fill="#1e3a8a" fill-opacity="0.4"/>
    <!-- Anéis elípticos -->
    <ellipse cx="35" cy="35" rx="30" ry="9" transform="rotate(-25 35 35)" stroke-width="1.6"/>
    <circle cx="15" cy="20" r="2" fill="#7dd3fc"/>
  </g>

  <!-- Mensageiro / Pássaro Origami Noturno (bottom) -->
  <g transform="translate(155, 290)" stroke="#7dd3fc" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity="0.75">
    <polygon points="35,10 15,25 35,40 45,25" fill="#1e3a8a" fill-opacity="0.3"/>
    <polyline points="15,25 55,20 35,40"/>
    <circle cx="55" cy="20" r="1.5" fill="#38bdf8"/>
  </g>
</svg>`;

export const CHAT_WALLPAPERS = {
  // Clássico: mantém exatamente o padrão WhatsApp original
  classic: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png',
  // Novos papéis de parede exclusivos em vetor SVG de alta definição
  'dark-premium': encodeSvgToDataUri(darkPremiumSvg),
  industrial: encodeSvgToDataUri(industrialSvg),
  'night-soft': encodeSvgToDataUri(nightSoftSvg),
};

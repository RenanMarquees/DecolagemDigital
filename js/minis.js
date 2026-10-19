'use strict';
/* ============================================================
   MINIATURAS E CENÁRIO — todos os desenhos do mapa são SVG feitos à mão,
   então ficam iguais em qualquer celular (sem depender de emoji).

   Cada miniatura é desenhada com o centro do hexágono em (0, 0):
   pés em y≈10, topo da cabeça em y≈-24, largura de -16 a 16.
   ============================================================ */

const TRACO = 'stroke="#0c0a14" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"';
const pele = '#f0cfa4';

/* Lobo de lado, usado por Lobo de Gelo e Fenrir (muda só cor e detalhes) */
function loboSvg(corpo, claro, escuro, olho, extras = '') {
  return `<path d="M-13 -3 Q-23 -8 -19 -16 Q-15 -9 -11 -1Z" fill="${claro}"/>
    <rect x="-10" y="3" width="3.4" height="8" fill="${escuro}"/><rect x="-5" y="4" width="3.4" height="7" fill="${escuro}"/>
    <rect x="4" y="4" width="3.4" height="7" fill="${escuro}"/><rect x="9" y="3" width="3.4" height="8" fill="${escuro}"/>
    <ellipse cx="-1" cy="-1" rx="13" ry="8" fill="${corpo}"/>
    <path d="M-8 -7 L-5 -12 L-2 -7 M0 -8 L3 -13 L5 -7" fill="${escuro}"/>
    <path d="M9 -8 L19 -3 L17 4 L9 5 Z" fill="${corpo}"/>
    <path d="M10 -8 L11 -15 L15 -8Z" fill="${escuro}"/>
    <circle cx="19" cy="-2" r="1.9" fill="#15121c"/>
    <circle cx="13.5" cy="-3" r="1.5" fill="${olho}"/>
    <path d="M13 4 L14.2 7 L15.4 4 M16 3.5 L17 6 L18 3.5" fill="#fff" stroke="none"/>${extras}`;
}

/* Cada entrada devolve o desenho (sem <svg>) de uma miniatura. */
const MINIS = {
  /* ---------- Heróis ---------- */
  guerreiro: () => `
    <rect x="-6" y="5" width="5" height="6" fill="#3d4a63"/><rect x="1" y="5" width="5" height="6" fill="#3d4a63"/>
    <path d="M-9 6 L-8 -6 Q0 -10 8 -6 L9 6 Z" fill="#6b8fc4"/>
    <rect x="-9" y="3" width="18" height="3" fill="#8b5a2b"/>
    <circle cx="0" cy="-12" r="6" fill="${pele}"/>
    <path d="M-7 -12 Q-7 -20 0 -20 Q7 -20 7 -12 L4 -12 L4 -14 L-4 -14 L-4 -12 Z" fill="#aab6c6"/>
    <path d="M0 -20 Q5 -26 9 -21 Q5 -20 0 -20Z" fill="#c0392b"/>
    <path d="M-18 -4 L-9 -4 L-9 5 Q-13.5 11 -18 5 Z" fill="#8b5a2b"/><circle cx="-13.5" cy="0.5" r="2" fill="#e8b84a"/>
    <rect x="11" y="-15" width="3" height="19" fill="#e4eaf2"/><rect x="8.5" y="3" width="8" height="2.5" fill="#e8b84a"/><rect x="11.2" y="5" width="2.6" height="4" fill="#6b3d1a"/>`,
  cacador: () => `
    <rect x="-5" y="5" width="4.5" height="6" fill="#5a3d22"/><rect x="1" y="5" width="4.5" height="6" fill="#5a3d22"/>
    <rect x="-13" y="-9" width="5" height="13" rx="1" fill="#7a4a24"/><path d="M-12 -9 L-11 -14 M-10 -9 L-9 -14" stroke="#e4eaf2" stroke-width="1.2"/>
    <path d="M-9 8 L-6 -8 Q0 -12 6 -8 L9 8 Z" fill="#3f7d4e"/>
    <path d="M-8 -9 Q0 -25 8 -9 Q0 -4 -8 -9 Z" fill="#2f6b3f"/><ellipse cx="0" cy="-10" rx="3.8" ry="3.4" fill="${pele}"/>
    <path d="M12 -19 Q22 -4 12 12" fill="none" stroke="#8b5a2b" stroke-width="2.4"/><path d="M12 -19 L12 12" stroke="#e4eaf2" stroke-width=".9"/>
    <path d="M-3 -2 L13 -4" stroke="#c9a227" stroke-width="1.6"/><path d="M13 -4 L10.5 -6 M13 -4 L10.5 -2" stroke="#e4eaf2" stroke-width="1"/>`,
  oraculo: () => `
    <path d="M-10 11 L-6 -8 Q0 -12 6 -8 L10 11 Z" fill="#7b4fc2"/><rect x="-9.5" y="7.5" width="19" height="3" fill="#e8b84a"/>
    <circle cx="0" cy="-12" r="5.5" fill="${pele}"/>
    <path d="M-9 -14 L0 -29 L9 -14 Q0 -10 -9 -14Z" fill="#5a3a99"/><path d="M0 -26 l1.4 3 3 .4 -2.2 2 .6 3 -2.8 -1.5 -2.8 1.5 .6 -3 -2.2 -2 3 -.4z" fill="#e8b84a" stroke="none" transform="scale(.6) translate(0 -2)"/>
    <rect x="12" y="-18" width="2.6" height="30" fill="#8b5a2b"/>
    <circle cx="13.3" cy="-21" r="5" fill="#7fd4ff"/><circle cx="12" cy="-22.5" r="1.6" fill="#fff" stroke="none"/>
    <path d="M-4 -6 L4 -6" stroke="#e8b84a" stroke-width="1.2"/>`,

  /* ---------- Valhala ---------- */
  draugr: () => `
    <rect x="-5.5" y="5" width="4.5" height="6" fill="#4a5448"/><rect x="1" y="5" width="4.5" height="6" fill="#4a5448"/>
    <path d="M-9 6 L-8 -6 Q0 -10 8 -6 L10 6 L6 4 L4 7 L0 4 L-4 7 L-6 4 Z" fill="#7e8f7a"/>
    <circle cx="0" cy="-12" r="6" fill="#cdd6c4"/>
    <circle cx="-2.4" cy="-12" r="1.6" fill="#15121c"/><circle cx="2.4" cy="-12" r="1.6" fill="#15121c"/><circle cx="-2.4" cy="-12" r=".7" fill="#7dffb0" stroke="none"/><circle cx="2.4" cy="-12" r=".7" fill="#7dffb0" stroke="none"/>
    <path d="M-2 -8.5 h4" stroke="#15121c"/>
    <path d="M-7 -13 Q-7 -20 0 -20 Q7 -20 7 -13 Z" fill="#6b6f78"/><path d="M-7 -15 L-12 -22 L-6 -18 M7 -15 L12 -22 L6 -18" fill="#e4dcc4"/>
    <rect x="12" y="-14" width="2.4" height="24" fill="#6b3d1a"/><path d="M14.4 -14 Q22 -12 22 -6 L14.4 -8 Z" fill="#aab6c6"/>`,
  lobo_gelo: () => loboSvg('#c9e2f5', '#e6f3fb', '#9bbbd6', '#2a6fd0'),
  valquiria: () => `
    <path d="M-7 -13 L-19 -24 L-13 -11 Z" fill="#f3f6fb"/><path d="M7 -13 L19 -24 L13 -11 Z" fill="#f3f6fb"/>
    <rect x="-5" y="5" width="4.5" height="6" fill="#3a2f5c"/><rect x="1" y="5" width="4.5" height="6" fill="#3a2f5c"/>
    <path d="M-10 8 L-7 -6 Q0 -10 7 -6 L10 8 Z" fill="#5b4a92"/><path d="M-4 -3 L4 -3" stroke="#c9d3e6"/>
    <path d="M-7 -12 Q-8 -4 -5 0 M7 -12 Q8 -4 5 0" fill="none" stroke="#e8c35a" stroke-width="2.4"/>
    <circle cx="0" cy="-12" r="5.6" fill="${pele}"/>
    <path d="M-6 -14 Q0 -22 6 -14 L4 -15 L0 -17 L-4 -15 Z" fill="#c9d3e6"/>
    <circle cx="-17" cy="-1" r="6.5" fill="#aab6c6"/><circle cx="-17" cy="-1" r="2.4" fill="#5b4a92"/>
    <rect x="13" y="-22" width="2" height="33" fill="#6b3d1a"/><path d="M14 -27 L17 -20 L11 -20 Z" fill="#e4eaf2"/>`,
  troll_gelo: () => `
    <rect x="-8" y="4" width="6" height="7" fill="#546a82"/><rect x="2" y="4" width="6" height="7" fill="#546a82"/>
    <path d="M-14 6 Q-17 -9 -7 -12 L7 -12 Q17 -9 14 6 Z" fill="#7e9ab5"/>
    <path d="M-10 -4 q3 -3 5 0 M2 -2 q3 -3 5 0 M-3 3 q3 -3 5 0" fill="none" stroke="#e8f2fb" stroke-width="2"/>
    <circle cx="0" cy="-14" r="6.5" fill="#8fa9c2"/>
    <circle cx="-2.6" cy="-15" r="1.4" fill="#15121c"/><circle cx="2.6" cy="-15" r="1.4" fill="#15121c"/>
    <path d="M-4 -9.5 L-3 -12.5 M4 -9.5 L3 -12.5" stroke="#f3f6fb" stroke-width="1.8"/>
    <path d="M-5 -19 L-3 -23 L0 -20 L3 -23 L5 -19" fill="#e8f2fb"/>
    <rect x="14" y="-18" width="4" height="30" rx="1.5" fill="#6b3d1a"/><path d="M12 -22 L20 -22 L21 -14 L11 -14Z" fill="#8b5a2b"/>`,
  fenrir: () => loboSvg('#3a3f52', '#59607a', '#262a38', '#ff3b3b',
    `<path d="M-8 -9 L-6 -16 L-3 -9 M-3 -9 L0 -17 L3 -9 M3 -9 L6 -16 L8 -8" fill="#262a38"/>
     <circle cx="7" cy="-1" r="1.8" fill="#aab6c6"/><circle cx="3.5" cy="-2" r="1.8" fill="#aab6c6"/><circle cx="0" cy="-2.5" r="1.8" fill="#aab6c6"/>
     <circle cx="-3.5" cy="-2" r="1.8" fill="#aab6c6"/><path d="M-3 -2 Q4 4 9 -1" fill="none" stroke="#8a93a8" stroke-width="1.2"/>`),

  /* ---------- Olimpo ---------- */
  harpia: () => `
    <path d="M-5 -6 Q-22 -14 -21 2 Q-15 -1 -12 6 Q-9 0 -5 4 Z" fill="#8c6b4a"/><path d="M5 -6 Q22 -14 21 2 Q15 -1 12 6 Q9 0 5 4 Z" fill="#8c6b4a"/>
    <path d="M-17 -3 L-14 3 M17 -3 L14 3 M-11 -2 L-9 3 M11 -2 L9 3" stroke="#5f4630" stroke-width="1"/>
    <path d="M-3 7 L-5 11 M3 7 L5 11" stroke="#e8b84a" stroke-width="2"/>
    <path d="M-6 8 L-7 -6 Q0 -10 7 -6 L6 8 Z" fill="#d8b090"/><path d="M-5 -1 L5 -1 M-5 3 L5 3" stroke="#a37f5f" stroke-width="1"/>
    <circle cx="0" cy="-12" r="5.6" fill="#e0b894"/>
    <path d="M-7 -14 Q-9 -23 -3 -21 Q0 -25 3 -21 Q9 -23 7 -14 Q4 -18 0 -17 Q-4 -18 -7 -14Z" fill="#6b4a2a"/>
    <circle cx="-2" cy="-12" r="1.1" fill="#15121c"/><circle cx="2" cy="-12" r="1.1" fill="#15121c"/>`,
  satiro: () => `
    <path d="M-7 4 Q-9 11 -6 12 L-3 12 L-3 4 Z M7 4 Q9 11 6 12 L3 12 L3 4 Z" fill="#8a5a3a"/>
    <path d="M-7 -4 Q-9 6 -3 8 L3 8 Q9 6 7 -4 Z" fill="#8a5a3a"/>
    <path d="M-8 4 L-7 -6 Q0 -10 7 -6 L8 4 Z" fill="#e0b48a"/>
    <circle cx="0" cy="-12" r="5.6" fill="#e0b48a"/>
    <path d="M-5 -16 Q-12 -20 -9 -26 Q-5 -21 -3 -17 M5 -16 Q12 -20 9 -26 Q5 -21 3 -17" fill="#e4dcc4"/>
    <path d="M-4 -8 Q0 -4 4 -8 Q0 -6 -4 -8Z" fill="#6b4a2a"/>
    <circle cx="-2" cy="-13" r="1" fill="#15121c"/><circle cx="2" cy="-13" r="1" fill="#15121c"/>
    <rect x="-3" y="-2" width="12" height="3" fill="#c9a227" transform="rotate(-18 0 0)"/>
    <path d="M-3 -2 L-5 2 M-1 -3 L-3 1 M1 -3 L-1 1 M3 -4 L1 0" stroke="#8b5a2b" stroke-width="1.3" transform="rotate(-18 0 0)"/>`,
  ciclope: () => `
    <rect x="-8" y="4" width="6.5" height="7" fill="#9c7448"/><rect x="1.5" y="4" width="6.5" height="7" fill="#9c7448"/>
    <path d="M-12 6 Q-15 -9 -6 -12 L6 -12 Q15 -9 12 6 Z" fill="#c79b6d"/><path d="M-12 3 L12 3 L11 7 L-11 7Z" fill="#7a5a36"/>
    <circle cx="0" cy="-13.5" r="7.5" fill="#d1a778"/>
    <ellipse cx="0" cy="-14" rx="4.6" ry="3.6" fill="#fff"/><circle cx="0.4" cy="-14" r="2.1" fill="#3a8f4a"/><circle cx="0.4" cy="-14" r=".9" fill="#15121c" stroke="none"/>
    <path d="M-5 -20 Q-1 -22 3 -20" fill="none" stroke="#5a3a1a" stroke-width="2"/>
    <path d="M-3 -8 Q0 -6 3 -8" fill="none" stroke="#5a3a1a" stroke-width="1.4"/>
    <rect x="14" y="-18" width="4" height="29" rx="1.5" fill="#6b3d1a"/><circle cx="16" cy="-19" r="5" fill="#8b6a40"/>`,
  minotauro: () => `
    <rect x="-7" y="4" width="5.5" height="7" fill="#5a3426"/><rect x="1.5" y="4" width="5.5" height="7" fill="#5a3426"/>
    <path d="M-12 6 Q-14 -8 -7 -11 L7 -11 Q14 -8 12 6 Z" fill="#8a4a32"/><rect x="-12" y="3" width="24" height="3" fill="#3d2a1a"/>
    <path d="M-7 -16 Q-17 -17 -15 -25 Q-10 -19 -5 -18 M7 -16 Q17 -17 15 -25 Q10 -19 5 -18" fill="#f1ead2"/>
    <path d="M-6 -17 Q0 -21 6 -17 L6 -8 Q0 -5 -6 -8 Z" fill="#6b3d26"/>
    <path d="M-3.5 -9 Q0 -6 3.5 -9 L3 -6 L-3 -6Z" fill="#d9a88c"/><circle cx="-1.2" cy="-7.5" r=".7" fill="#15121c" stroke="none"/><circle cx="1.2" cy="-7.5" r=".7" fill="#15121c" stroke="none"/>
    <circle cx="-3" cy="-14" r="1.2" fill="#ffd34d"/><circle cx="3" cy="-14" r="1.2" fill="#ffd34d"/>
    <rect x="13" y="-16" width="2.6" height="26" fill="#6b3d1a"/><path d="M15.6 -17 Q24 -14 22 -6 Q19 -10 15.6 -9Z" fill="#aab6c6"/>`,
  ares: () => `
    <path d="M-8 4 Q-16 -4 -12 -18 Q-6 -10 -5 -6 Z" fill="#a02a2a"/>
    <rect x="-5.5" y="5" width="4.8" height="6" fill="#7a5a1a"/><rect x="0.7" y="5" width="4.8" height="6" fill="#7a5a1a"/>
    <path d="M-9 6 L-8 -6 Q0 -10 8 -6 L9 6 Z" fill="#c8892a"/><path d="M-6 -2 L6 -2 M-6 2 L6 2" stroke="#8a5a14" stroke-width="1"/>
    <circle cx="0" cy="-12" r="5.8" fill="${pele}"/>
    <path d="M-7 -12 Q-7 -20 0 -20 Q7 -20 7 -12 L4 -12 L4 -14 L-4 -14 L-4 -12 Z" fill="#d6a030"/>
    <path d="M-2 -20 Q0 -29 7 -27 Q10 -24 4 -20 Z M-2 -20 Q-6 -28 -12 -25 Q-10 -21 -2 -20 Z" fill="#c0392b"/>
    <circle cx="-14" cy="0" r="7.5" fill="#b02a2a"/><circle cx="-14" cy="0" r="4" fill="none" stroke="#e8b84a" stroke-width="1.6"/><circle cx="-14" cy="0" r="1.2" fill="#e8b84a" stroke="none"/>
    <rect x="12" y="-24" width="2" height="35" fill="#6b3d1a"/><path d="M13 -30 L16.4 -22 L9.6 -22Z" fill="#e4eaf2"/>`,

  /* ---------- Inferno ---------- */
  alma_penada: () => `
    <path d="M-10 8 Q-14 -2 -9 -10 Q0 -22 9 -10 Q14 -2 10 8 L7 4 L4 10 L0 4 L-4 10 L-7 4 Z" fill="#cfe9ff" fill-opacity=".88"/>
    <path d="M-13 -2 Q-18 -4 -17 -10 M13 -2 Q18 -4 17 -10" fill="none" stroke="#cfe9ff" stroke-width="2.2" stroke-opacity=".7"/>
    <ellipse cx="-3.6" cy="-9" rx="2.3" ry="3.3" fill="#1d2a4a"/><ellipse cx="3.6" cy="-9" rx="2.3" ry="3.3" fill="#1d2a4a"/>
    <ellipse cx="0" cy="-2" rx="2.2" ry="3.6" fill="#1d2a4a"/>
    <circle cx="-3.6" cy="-9.5" r=".9" fill="#8ff" stroke="none"/><circle cx="3.6" cy="-9.5" r=".9" fill="#8ff" stroke="none"/>`,
  diabrete: () => `
    <path d="M-5 -2 Q-20 -12 -17 3 Q-11 -2 -8 5 Z" fill="#8f1f1f"/><path d="M5 -2 Q20 -12 17 3 Q11 -2 8 5 Z" fill="#8f1f1f"/>
    <path d="M7 8 Q14 12 12 5" fill="none" stroke="#c0392b" stroke-width="2"/><path d="M12 5 L15 3 L14 7Z" fill="#c0392b"/>
    <rect x="-5" y="5" width="4.2" height="6" fill="#8f1f1f"/><rect x="0.8" y="5" width="4.2" height="6" fill="#8f1f1f"/>
    <ellipse cx="0" cy="0" rx="8.5" ry="8" fill="#d6453a"/>
    <circle cx="0" cy="-11" r="6.2" fill="#e05a48"/>
    <path d="M-5 -15 L-9 -23 L-2 -17 M5 -15 L9 -23 L2 -17" fill="#4a1010"/>
    <path d="M-4.5 -12 L-1.5 -10.8 M4.5 -12 L1.5 -10.8" stroke="#15121c" stroke-width="1.6"/><circle cx="-2.8" cy="-11" r="1" fill="#ffe14d" stroke="none"/><circle cx="2.8" cy="-11" r="1" fill="#ffe14d" stroke="none"/>
    <path d="M-3.5 -7 Q0 -4.5 3.5 -7" fill="#fff"/>
    <rect x="12" y="-18" width="2" height="29" fill="#6b6f78"/><path d="M9.5 -18 L9.5 -23 M13 -18 L13 -25 M16.5 -18 L16.5 -23 M9.5 -18 L16.5 -18" stroke="#aab6c6" stroke-width="1.8" fill="none"/>`,
  cerbero: () => {
    const cabeca = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">
      <path d="M-5 6 L-4 -3 Q0 -7 4 -3 L5 6 Z" fill="#4a2f2a"/>
      <path d="M-5 -3 L-6.5 -10 L-1.5 -6 M5 -3 L6.5 -10 L1.5 -6" fill="#2a1612"/>
      <ellipse cx="0" cy="-2" rx="5.4" ry="4.6" fill="#5a3a33"/>
      <path d="M-3 0 L0 5 L3 0 Z" fill="#6b4a42"/><circle cx="0" cy="4.6" r="1.2" fill="#15121c" stroke="none"/>
      <circle cx="-2.2" cy="-3" r="1.1" fill="#ff7a45" stroke="none"/><circle cx="2.2" cy="-3" r="1.1" fill="#ff7a45" stroke="none"/>
      <path d="M-1.8 4 L-1.2 6.4 L-0.4 4 M0.4 4 L1.2 6.4 L1.8 4" fill="#fff" stroke="none"/></g>`;
    return `<path d="M-13 1 Q-21 -1 -19 -9 Q-14 -4 -11 -3Z" fill="#3a1f1a"/>
      <rect x="-10" y="4" width="3.6" height="7" fill="#2a1612"/><rect x="-4" y="5" width="3.6" height="6" fill="#2a1612"/><rect x="3" y="5" width="3.6" height="6" fill="#2a1612"/><rect x="9" y="4" width="3.6" height="7" fill="#2a1612"/>
      <ellipse cx="0" cy="0" rx="14" ry="8" fill="#4a2f2a"/>
      ${cabeca(-7, -13, 0.85)}${cabeca(9, -13, 0.85)}${cabeca(1, -15, 1.05)}
      <path d="M-6 -5 L-4 -1 L-2 -5 M2 -5 L4 -1 L6 -5 M9 -5 L11 -1 L13 -5" fill="#aab6c6" stroke="none"/>`;
  },
  demonio: () => `
    <path d="M-5 -6 Q-24 -22 -22 4 Q-16 -2 -13 6 Q-9 0 -5 4Z" fill="#6a1a22"/><path d="M5 -6 Q24 -22 22 4 Q16 -2 13 6 Q9 0 5 4Z" fill="#6a1a22"/>
    <path d="M-19 -6 L-13 2 M19 -6 L13 2" stroke="#3a0e12"/>
    <rect x="-6" y="5" width="5" height="6" fill="#4a1018"/><rect x="1" y="5" width="5" height="6" fill="#4a1018"/>
    <path d="M-9 7 L-8 -7 Q0 -11 8 -7 L9 7 Z" fill="#a02a34"/><path d="M-4 -4 L0 1 L4 -4" fill="none" stroke="#e8613a" stroke-width="1.6"/>
    <circle cx="0" cy="-13" r="6" fill="#b83a44"/>
    <path d="M-5 -17 Q-11 -20 -9 -27 Q-4 -22 -2 -18 M5 -17 Q11 -20 9 -27 Q4 -22 2 -18" fill="#2a0a0e"/>
    <circle cx="-2.4" cy="-13.5" r="1.3" fill="#ffd34d" stroke="none"/><circle cx="2.4" cy="-13.5" r="1.3" fill="#ffd34d" stroke="none"/>
    <path d="M-3 -9.2 L-1.5 -10.5 L0 -9.2 L1.5 -10.5 L3 -9.2" fill="none" stroke="#fff" stroke-width="1"/>
    <rect x="12" y="-14" width="2.4" height="22" fill="#6b6f78"/><path d="M13.2 -26 Q17 -18 14 -14 L12.4 -14 Q9 -18 13.2 -26Z" fill="#ff8a3a"/>`,
  hades: () => `
    <path d="M-12 11 L-8 -6 Q0 -11 8 -6 L12 11 Z" fill="#2b2650"/><path d="M-12 11 L12 11 L13 8 L-13 8Z" fill="#1a1635"/>
    <path d="M-6 -2 L0 6 L6 -2" fill="none" stroke="#5fc7ff" stroke-width="1.4"/>
    <circle cx="0" cy="-12" r="5.8" fill="#b9bfd8"/>
    <path d="M-6 -15 Q-9 -26 -3 -22 Q-2 -29 2 -23 Q8 -28 7 -15 Q4 -19 0 -18 Q-3 -19 -6 -15Z" fill="#5fc7ff"/>
    <path d="M-5.5 -16 L-5.5 -21 L-2.8 -18.6 L0 -22 L2.8 -18.6 L5.5 -21 L5.5 -16 Z" fill="#e8b84a"/>
    <circle cx="-2.2" cy="-12" r="1.1" fill="#5fc7ff" stroke="none"/><circle cx="2.2" cy="-12" r="1.1" fill="#5fc7ff" stroke="none"/>
    <rect x="12" y="-22" width="2.2" height="33" fill="#8a7a3a"/><path d="M9 -22 L9 -27 M13 -22 L13 -29 M17 -22 L17 -27 M9 -22 L17 -22" stroke="#e8b84a" stroke-width="2" fill="none"/>`,

  /* ---------- Duat ---------- */
  escaravelho: () => `
    <path d="M-10 -1 L-17 -7 M-11 3 L-18 5 M-9 7 L-15 12 M10 -1 L17 -7 M11 3 L18 5 M9 7 L15 12" stroke="#0e3a37" stroke-width="2"/>
    <ellipse cx="0" cy="2" rx="11" ry="12.5" fill="#1f6f6a"/>
    <path d="M0 -10 L0 14" stroke="#0e3a37"/><path d="M-9 -2 Q-4 -5 0 -3 Q4 -5 9 -2 M-9 6 Q-4 3 0 5 Q4 3 9 6" fill="none" stroke="#e8b84a" stroke-width="1.6"/>
    <circle cx="0" cy="-12" r="5" fill="#2a8a83"/>
    <path d="M-3 -16 L-7 -22 M3 -16 L7 -22" stroke="#e8b84a" stroke-width="2"/><path d="M-4 -9 L-6 -6 M4 -9 L6 -6" stroke="#0e3a37" stroke-width="1.6"/>
    <circle cx="-2" cy="-13" r="1" fill="#ffd34d" stroke="none"/><circle cx="2" cy="-13" r="1" fill="#ffd34d" stroke="none"/>`,
  mumia: () => `
    <rect x="-5.5" y="5" width="5" height="6" fill="#cdbf90"/><rect x="0.5" y="5" width="5" height="6" fill="#cdbf90"/>
    <path d="M-9 6 L-8 -6 Q0 -10 8 -6 L9 6 Z" fill="#d9cfa8"/>
    <path d="M-9 -3 L9 -1 M-9 1 L9 3 M-8.5 -6.5 L8.5 -4.5" stroke="#8d8160" stroke-width="1.2" fill="none"/>
    <path d="M-8 -3 L-18 -1 L-18 3 L-8 2Z" fill="#d9cfa8"/><path d="M8 -3 L17 -1 L17 3 L8 2Z" fill="#d9cfa8"/>
    <circle cx="0" cy="-12" r="6" fill="#d9cfa8"/>
    <path d="M-6 -14 L6 -11.5 M-6.2 -10 L6.2 -8" stroke="#8d8160" stroke-width="1.2"/>
    <circle cx="2" cy="-12.6" r="1.7" fill="#15121c"/><circle cx="2" cy="-12.6" r=".8" fill="#6bff8a" stroke="none"/>
    <path d="M6 -13 Q11 -12 10 -8" fill="none" stroke="#d9cfa8" stroke-width="1.6"/>`,
  chacal: () => `
    <rect x="-5.5" y="5" width="4.8" height="6" fill="#1d2a4a"/><rect x="0.7" y="5" width="4.8" height="6" fill="#1d2a4a"/>
    <path d="M-9 6 L-8 -6 Q0 -10 8 -6 L9 6 Z" fill="#2b3f72"/><path d="M-9 3 L9 3 L10 7 L-10 7Z" fill="#e8e0c8"/>
    <path d="M-7 -6 Q0 -2 7 -6 L5 -9 L-5 -9Z" fill="#e8b84a"/>
    <path d="M-6 -12 Q-6 -17 0 -17 Q6 -17 6 -12 L8 -8 L2 -6 L-2 -6 L-8 -8Z" fill="#26283a"/>
    <path d="M-5 -16 L-8 -27 L-1 -18 M5 -16 L8 -27 L1 -18" fill="#26283a"/><path d="M-6.6 -24 L-5.4 -19 M6.6 -24 L5.4 -19" stroke="#e8b84a" stroke-width="1.2"/>
    <path d="M-2 -8 L0 -5 L2 -8" fill="#e8b84a"/><circle cx="-2.4" cy="-13" r="1" fill="#ffd34d" stroke="none"/><circle cx="2.4" cy="-13" r="1" fill="#ffd34d" stroke="none"/>
    <rect x="12" y="-18" width="2.2" height="29" fill="#8a7a3a"/><path d="M10 -18 Q13 -25 16.4 -18 Z" fill="#e8b84a"/>`,
  serpente: () => `
    <ellipse cx="0" cy="9" rx="14" ry="4.5" fill="#3f7d2f"/><path d="M-12 8 Q0 2 12 8" fill="none" stroke="#9bd05a" stroke-width="1.4"/>
    <path d="M-10 6 Q-14 -2 -4 -2 Q6 -2 6 -8" fill="none" stroke="#4f8f3f" stroke-width="7.5"/>
    <path d="M-10 6 Q-14 -2 -4 -2 Q6 -2 6 -8" fill="none" stroke="#6bb04a" stroke-width="2" stroke-dasharray="3 4"/>
    <path d="M-1 -9 Q-9 -14 -4 -22 Q0 -25 6 -24 Q12 -22 9 -14 Q8 -8 4 -9 Z" fill="#4f8f3f"/>
    <path d="M-2 -14 Q1 -20 5 -14" fill="none" stroke="#e8b84a" stroke-width="1.4"/>
    <circle cx="-0.5" cy="-18" r="1.3" fill="#ffd34d"/><circle cx="4" cy="-18" r="1.3" fill="#ffd34d"/><circle cx="-0.5" cy="-18" r=".5" fill="#15121c" stroke="none"/><circle cx="4" cy="-18" r=".5" fill="#15121c" stroke="none"/>
    <path d="M1.5 -9 L1.5 -5 L0 -2.5 M1.5 -5 L3 -2.5" fill="none" stroke="#d6453a" stroke-width="1.2"/>`,
  set: () => `
    <path d="M-10 9 Q-22 6 -19 -9 Q-16 -18 -8 -17" fill="none" stroke="#a0472a" stroke-width="5"/>
    <path d="M-8 -17 L-3 -22 L-4 -15Z" fill="#ffd34d"/>
    <path d="M-9 -2 L-19 4 L-14 9 L-7 3 M9 -2 L19 4 L14 9 L7 3" fill="#c9582f"/>
    <path d="M-19 4 L-23 2 L-21 8 M19 4 L23 2 L21 8" fill="#8f3a1f"/>
    <path d="M-12 4 L-17 11 M-8 6 L-12 12 M12 4 L17 11 M8 6 L12 12" stroke="#8f3a1f" stroke-width="2"/>
    <ellipse cx="0" cy="2" rx="11" ry="10" fill="#c9582f"/>
    <path d="M-8 -2 Q0 -6 8 -2 M-9 3 Q0 -1 9 3 M-8 8 Q0 4 8 8" fill="none" stroke="#8f3a1f" stroke-width="1.3"/>
    <path d="M-6 -7 Q-6 -14 0 -14 Q6 -14 6 -7 Z" fill="#d6633a"/>
    <path d="M-5 -13 L-8 -22 M5 -13 L8 -22" stroke="#26283a" stroke-width="2.6"/>
    <path d="M-5 -12 Q0 -9 5 -12 L3 -7 L-3 -7Z" fill="#26283a"/>
    <circle cx="-2.4" cy="-10.5" r="1.1" fill="#ff3b3b" stroke="none"/><circle cx="2.4" cy="-10.5" r="1.1" fill="#ff3b3b" stroke="none"/>
    <path d="M-5 -17 L5 -17 L5 -19 L0 -21 L-5 -19Z" fill="#e8b84a"/>`,

  /* ---------- Final ---------- */
  caos: () => `
    <circle cx="0" cy="-3" r="17" fill="url(#gcaos)"/>
    <path d="M-17 -3 Q-10 -14 0 -9 Q10 -4 17 -10 M-15 6 Q-6 -2 4 3 Q11 6 15 0" fill="none" stroke="#c58bff" stroke-width="1.6" stroke-opacity=".7"/>
    <path d="M-14 11 Q-19 4 -12 0 M14 11 Q19 4 12 0 M-4 15 Q0 8 4 15" fill="none" stroke="#7a4bd0" stroke-width="3"/>
    <ellipse cx="0" cy="-8" rx="6.5" ry="4.5" fill="#fff"/><circle cx="0" cy="-8" r="2.8" fill="#8a2be2"/><circle cx="0" cy="-8" r="1.2" fill="#05000c" stroke="none"/>
    <ellipse cx="-9" cy="2" rx="3.3" ry="2.3" fill="#fff"/><circle cx="-9" cy="2" r="1.3" fill="#8a2be2" stroke="none"/>
    <ellipse cx="9" cy="2" rx="3.3" ry="2.3" fill="#fff"/><circle cx="9" cy="2" r="1.3" fill="#8a2be2" stroke="none"/>
    <circle cx="-4" cy="-18" r="1" fill="#fff" stroke="none"/><circle cx="8" cy="-14" r=".8" fill="#fff" stroke="none"/><circle cx="-12" cy="-8" r=".8" fill="#fff" stroke="none"/>`,
};

/** Miniatura (para dentro de um <g>). id = id do inimigo ou da classe do herói. */
function miniatura(id) {
  const f = MINIS[id] || MINIS.draugr;
  return `<g ${TRACO}>${f()}</g>`;
}

/** Miniatura pronta para uso em listas e painéis (um <svg> pequeno). */
function miniIcone(id, tam = 30) {
  return `<svg class="mini-ico" viewBox="-22 -31 44 46" width="${tam}" height="${Math.round(tam * 46 / 44)}" aria-hidden="true">${miniatura(id)}</svg>`;
}

/* ---------- Elementos de cenário (cabem num hexágono de raio 27) ---------- */
const PROPS = {
  pinheiro: () => `<g ${TRACO}><rect x="-2.5" y="8" width="5" height="7" fill="#5a3d22"/>
    <path d="M0 -24 L9 -10 L4 -10 L12 2 L-12 2 L-4 -10 L-9 -10 Z" fill="#2f6b4a"/><path d="M-13 2 L13 2 L16 11 L-16 11 Z" fill="#3a7f58"/>
    <path d="M0 -24 L4.5 -16 L-4.5 -16Z M-4 -10 L4 -10 L7 -5 L-7 -5Z" fill="#f3f8ff" stroke="none"/></g>`,
  runa: () => `<g ${TRACO}><path d="M-12 14 L-10 -14 Q0 -22 10 -14 L12 14 Z" fill="#7d8798"/><path d="M-10 -14 Q0 -22 10 -14 L8 -12 Q0 -18 -8 -12Z" fill="#a9b3c4" stroke="none"/>
    <path d="M0 -10 L0 8 M-5 -4 L5 -4 M-4 3 L0 -2 L4 3" fill="none" stroke="#7fd4ff" stroke-width="2.2"/></g>`,
  coluna: () => `<g ${TRACO}><rect x="-12" y="11" width="24" height="5" rx="1" fill="#d8d2c2"/><rect x="-8" y="-14" width="16" height="25" fill="#ece6d6"/>
    <path d="M-4 -14 L-4 11 M0 -14 L0 11 M4 -14 L4 11" stroke="#c9c2ae" stroke-width="1.4" fill="none"/>
    <rect x="-13" y="-20" width="26" height="6" rx="1.5" fill="#f5f0e2"/><path d="M-13 -20 Q-16 -23 -11 -23 L11 -23 Q16 -23 13 -20Z" fill="#d8d2c2"/></g>`,
  arbusto: () => `<g ${TRACO}><circle cx="-8" cy="4" r="9" fill="#2f7a3a"/><circle cx="8" cy="4" r="9" fill="#2f7a3a"/><circle cx="0" cy="-5" r="11" fill="#3a8f46"/>
    <circle cx="-4" cy="-8" r="2" fill="#ffd34d" stroke="none"/><circle cx="6" cy="-2" r="2" fill="#ff8aa0" stroke="none"/><circle cx="-9" cy="3" r="1.8" fill="#ffd34d" stroke="none"/></g>`,
  espinho: () => `<g ${TRACO}><path d="M-14 14 L-10 -2 L-5 14Z" fill="#3a2a30"/><path d="M-6 14 L0 -24 L7 14Z" fill="#4a343c"/><path d="M5 14 L11 -8 L15 14Z" fill="#3a2a30"/>
    <path d="M0 -24 L2 -8 L-1 -6Z" fill="#7a5a62" stroke="none"/><path d="M-7 12 L7 12" stroke="#ff7a45" stroke-width="2.4" stroke-opacity=".8"/></g>`,
  obelisco: () => `<g ${TRACO}><path d="M-9 15 L-6 -16 L0 -26 L6 -16 L9 15 Z" fill="#c9a86a"/><path d="M0 -26 L6 -16 L-6 -16Z" fill="#e8b84a"/>
    <path d="M-3 -10 L3 -10 M-3 -4 L3 -4 M-3 2 L3 2 M-2 8 L2 8" stroke="#6b4a1a" stroke-width="1.6"/><rect x="-12" y="12" width="24" height="5" fill="#a9884a"/></g>`,
  sarcofago: () => `<g ${TRACO}><path d="M-11 -18 Q0 -24 11 -18 L9 16 L-9 16 Z" fill="#d4a93a"/><path d="M-8 -16 Q0 -21 8 -16 L7 -6 L-7 -6Z" fill="#2a8a83"/>
    <circle cx="0" cy="-11" r="3.4" fill="#f0cfa4"/><path d="M-6 -3 L6 -3 M-6 2 L6 2 M-6 7 L6 7" stroke="#8a6a1a" stroke-width="1.6"/></g>`,
  cristal: () => `<g ${TRACO}><path d="M-12 14 L-8 -6 L-3 14Z" fill="#7a4bd0"/><path d="M-5 14 L2 -26 L9 14Z" fill="#9a6bf0"/><path d="M6 14 L11 -10 L15 14Z" fill="#7a4bd0"/>
    <path d="M2 -26 L4 -6 L1 -4Z" fill="#e0c8ff" stroke="none"/><circle cx="9" cy="-14" r="1.4" fill="#fff" stroke="none"/></g>`,
};

/* Desenho dos obstáculos baixos (lava, fenda...). Retorna detalhes por cima do hexágono pintado pelo CSS. */
const LIQUIDOS = {
  fenda: () => `<path d="M-14 -4 L-6 2 L-12 8 M4 -10 L10 -2 L5 6 M0 10 L8 14" fill="none" stroke="#9fc4e8" stroke-width="1.6" stroke-opacity=".5"/>`,
  nuvem: () => `<g fill="#fff" fill-opacity=".85" stroke="none"><circle cx="-6" cy="3" r="7"/><circle cx="4" cy="0" r="8"/><circle cx="11" cy="5" r="5"/><rect x="-12" y="4" width="26" height="6" rx="3"/></g>`,
  lava: () => `<path d="M-14 -3 Q-8 -8 -3 -3 T8 -3 T16 -3 M-14 6 Q-8 1 -3 6 T8 6" fill="none" stroke="#ffe08a" stroke-width="2" stroke-opacity=".75"/><circle cx="-5" cy="11" r="1.6" fill="#fff2b0" stroke="none"/>`,
  areia: () => `<path d="M-13 -2 Q-6 -6 0 -2 T13 -2 M-13 6 Q-6 2 0 6 T13 6" fill="none" stroke="#e8c97a" stroke-width="1.4" stroke-opacity=".5"/><ellipse cx="0" cy="2" rx="6" ry="2.6" fill="#1a1208" stroke="none" fill-opacity=".6"/>`,
  vazio: () => `<g fill="#fff" stroke="none"><circle cx="-8" cy="-6" r="1.2"/><circle cx="6" cy="4" r="1"/><circle cx="-2" cy="10" r="1.3"/><circle cx="10" cy="-8" r=".8"/></g>`,
};

/** Pequenos detalhes no chão (neve, rachaduras, areia...), diferentes em cada hexágono. */
function decorChao(reinoId, c, r) {
  const h = (Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663)) >>> 0;
  const a = (h % 17) - 8, b = ((h >> 5) % 15) - 7;
  switch (reinoId) {
    case 'valhala':
      return h % 4 === 0 ? `<g fill="#fff" fill-opacity=".55"><circle cx="${a}" cy="${b}" r="1.3"/><circle cx="${-b}" cy="${a / 2}" r="1"/><circle cx="${b / 2}" cy="${-a}" r="1.2"/></g>`
        : h % 11 === 1 ? `<path d="M${a - 3} ${b} h6 M${a} ${b - 3} v6" stroke="#7fd4ff" stroke-opacity=".35" stroke-width="1.4"/>` : '';
    case 'olimpo':
      return h % 3 === 0 ? `<path d="M${a - 8} ${b} Q${a} ${b - 6} ${a + 8} ${b + 2}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2"/>`
        : h % 13 === 2 ? `<circle cx="${a}" cy="${b}" r="2" fill="#e8b84a" fill-opacity=".35"/>` : '';
    case 'inferno':
      return h % 3 === 0 ? `<path d="M${a - 6} ${b - 3} L${a} ${b + 1} L${a + 2} ${b - 4} L${a + 8} ${b + 2}" fill="none" stroke="#ff7a45" stroke-opacity=".4" stroke-width="1.3"/>`
        : h % 9 === 4 ? `<circle cx="${a}" cy="${b}" r="1.3" fill="#ffb02e" fill-opacity=".7"/>` : '';
    case 'duat':
      return h % 3 === 0 ? `<path d="M${a - 8} ${b} Q${a - 4} ${b - 3} ${a} ${b} T${a + 8} ${b}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="1.3"/>`
        : h % 12 === 5 ? `<path d="M${a - 3} ${b} h6 M${a} ${b - 3} v5 M${a - 3} ${b + 3} h6" stroke="#e8b84a" stroke-opacity=".3" stroke-width="1.3"/>` : '';
    default: // caos
      return h % 3 === 0 ? `<circle cx="${a}" cy="${b}" r="${1 + (h % 3) * 0.3}" fill="#e0c8ff" fill-opacity=".6"/>` : '';
  }
}

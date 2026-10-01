/**
 * GSI PRO - Sistema de Gamificação e Patentes
 * Define as regras de evolução e nomes das patentes
 */

export const getGamificationStats = (totalEntries: number, role: string) => {
  // 1 ponto marcado = 100 XP
  // Faltas (0h) = 0 XP
  const xp = totalEntries * 100;
  
  // Níveis baseados em 1000 XP (aproximadamente 10 dias de trabalho)
  const level = Math.floor(xp / 1000);
  const xpIntoLevel = xp % 1000;
  const progress = (xpIntoLevel / 1000) * 100;

  const ranks: Record<string, string[]> = {
    'Ajudante': [
      'Recruta Ajudante',
      'Ajudante Iniciante',
      'Ajudante Operacional',
      'Ajudante Avançado',
      'Ajudante Elite',
      'Ajudante Especialista',
      'Ajudante Master',
      'Lenda do Canteiro'
    ],
    'Oficial': [
      'Oficial Aprendiz',
      'Oficial Técnico',
      'Oficial de Primeira',
      'Oficial Sênior',
      'Oficial Comandante',
      'Oficial Veterano',
      'Oficial Elite',
      'Mestre de Ofício'
    ],
    'Motorista': [
      'Motorista Novato',
      'Motorista de Rota',
      'Motorista Logístico',
      'Piloto de Carga',
      'Motorista Premium',
      'Motorista Executivo',
      'Águia do Asfalto',
      'Mestre do Volante'
    ],
    'Encarregado': [
      'Sub-Encarregado',
      'Encarregado de Campo',
      'Gestor de Equipa',
      'Encarregado Geral',
      'Líder Estratégico',
      'Encarregado Master',
      'Diretor de Obra',
      'General GSI'
    ]
  };

  const defaultRanks = [
    'Iniciante Nível 0',
    'Nível Bronze',
    'Nível Prata',
    'Nível Ouro',
    'Nível Platina',
    'Nível Diamante',
    'Nível Elite',
    'Nível Supremo'
  ];

  const currentRoleRanks = ranks[role] || defaultRanks;
  const rankName = currentRoleRanks[Math.min(level, currentRoleRanks.length - 1)];

  return {
    level,
    xp,
    rankName,
    progress,
    nextLevelXP: 1000
  };
};

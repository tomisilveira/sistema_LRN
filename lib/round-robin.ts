// Todos-contra-todos: cada equipo juega una vez contra cada otro equipo del
// mismo grupo. Alcanza para el tamaño de grupos típico de la Liga (4-6
// equipos); no arma un cronograma por rondas, eso lo asigna el admin a mano
// (cancha + turno) desde el panel.
export function generateRoundRobinPairs(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

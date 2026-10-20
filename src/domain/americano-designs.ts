export type IndexedGame = [[number, number], [number, number]]

// A starter partitions the players in one round. Translating its finite labels
// cyclically gives every partnership once and every opposition twice.
// For even fields the final label is fixed (the usual infinity point).
const CYCLIC_STARTERS: Partial<Record<number, IndexedGame[]>> = {
  4: [[[0, 1], [2, 3]]],
  8: [[[0, 1], [2, 4]], [[3, 6], [5, 7]]],
  12: [[[0, 1], [2, 5]], [[3, 7], [8, 10]], [[4, 9], [6, 11]]],
  16: [[[0, 1], [2, 6]], [[3, 9], [7, 15]], [[5, 13], [10, 12]], [[4, 14], [8, 11]]],
  20: [[[0, 1], [2, 4]], [[7, 16], [8, 14]], [[5, 19], [11, 15]], [[3, 17], [9, 12]], [[6, 13], [10, 18]]],
  21: [[[1, 2], [3, 6]], [[7, 17], [10, 15]], [[5, 18], [8, 14]], [[9, 11], [16, 20]], [[4, 13], [12, 19]]],
  24: [[[23, 0], [1, 2]], [[3, 5], [9, 13]], [[8, 18], [16, 19]], [[7, 14], [10, 21]], [[4, 22], [11, 17]], [[6, 15], [12, 20]]],
}

function translate(
  starter: IndexedGame[],
  rounds: number,
  add: (player: number, shift: number) => number,
): IndexedGame[][] {
  return Array.from({ length: rounds }, (_, shift) => starter.map(([a, b]) => [
    [add(a[0], shift), add(a[1], shift)],
    [add(b[0], shift), add(b[1], shift)],
  ]))
}

/**
 * Exact whist designs: every pair partners once and opposes twice. Returned
 * rounds use disjoint players and have one rotating bye for odd field sizes.
 * Construction is deterministic and quadratic in the number of players (the
 * output size); there is no scheduling search. Unsupported sizes return null.
 */
export function buildBalancedDesign(playerCount: number): IndexedGame[][] | null {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 128) return null

  const cyclic = CYCLIC_STARTERS[playerCount]
  if (cyclic) {
    const even = playerCount % 2 === 0
    const modulus = even ? playerCount - 1 : playerCount
    return translate(cyclic, modulus, (player, shift) =>
      even && player === modulus ? player : (player + shift) % modulus)
  }
  if (playerCount % 4 !== 1) return null

  const squareRoot = Math.sqrt(playerCount)
  let add: (a: number, b: number) => number
  let negate: (a: number) => number
  let rotate: (a: number) => number
  if (Number.isInteger(squareRoot)) {
    // On Z_m × Z_m, J(a,b)=(-b,a) squares to -I. This also supplies the
    // nine-player design, for which a cyclic Z_9 starter does not exist.
    const m = squareRoot
    const encode = (a: number, b: number) => ((a + m) % m) + m * ((b + m) % m)
    add = (a, b) => encode(a % m + b % m, Math.floor(a / m) + Math.floor(b / m))
    negate = (a) => encode(-(a % m), -Math.floor(a / m))
    rotate = (a) => encode(-Math.floor(a / m), a % m)
  } else {
    // In Z_n any root of -1 supplies the same order-four automorphism.
    // This covers primes n=1 (mod 4), plus composites such as 65 and 85.
    let root = 2
    while (root < playerCount && root * root % playerCount !== playerCount - 1) root += 1
    if (root === playerCount) return null
    add = (a, b) => (a + b) % playerCount
    negate = (a) => (playerCount - a) % playerCount
    rotate = (a) => root * a % playerCount
  }

  // Partition nonzero labels into {x,-x,Jx,-Jx}, pairing opposite points.
  // Partner differences are ±2x; opponent differences are ±(I±J)x.
  // Both 2I and I+J are invertible, so their translations give the exact
  // required multiplicities for every nonzero difference.
  const seen = new Set<number>()
  const starter: IndexedGame[] = []
  for (let player = 1; player < playerCount; player += 1) {
    if (seen.has(player)) continue
    const rotated = rotate(player)
    const game: IndexedGame = [[player, negate(player)], [rotated, negate(rotated)]]
    for (const member of game.flat()) seen.add(member)
    starter.push(game)
  }
  return translate(starter, playerCount, add)
}

export type AmericanoPartnership = [number, number]

type Matching = AmericanoPartnership[]

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

function factors(count: number): Matching[] {
  const circle = Array.from({ length: count }, (_, index) => index)
  if (count % 2) circle.push(-1)
  const result: Matching[] = []
  for (let round = 0; round < circle.length - 1; round += 1) {
    const teams: Matching = []
    for (let index = 0; index < circle.length / 2; index += 1) {
      const first = circle[index], second = circle[circle.length - 1 - index]
      if (first >= 0 && second >= 0) teams.push([first, second])
    }
    result.push(teams)
    circle.splice(1, 0, circle.pop()!)
  }
  return result
}

/** Move one edge of cardinality between two disjoint color classes.
 * Their union consists of alternating paths and cycles. Since the donor has
 * more edges, at least one path starts and ends with donor edges. Swapping its
 * colors shrinks the donor by one and grows the recipient by one, preserving
 * both matchings and every individual partnership edge.
 */
function transfer(donor: Matching, recipient: Matching, count: number): void {
  const donorMate = new Int32Array(count).fill(-1)
  const recipientMate = new Int32Array(count).fill(-1)
  for (const [a, b] of donor) { donorMate[a] = b; donorMate[b] = a }
  for (const [a, b] of recipient) { recipientMate[a] = b; recipientMate[b] = a }
  const key = ([a, b]: AmericanoPartnership) => Math.min(a, b) * count + Math.max(a, b)

  for (let start = 0; start < count; start += 1) {
    if (donorMate[start] < 0 || recipientMate[start] >= 0) continue
    const fromDonor: Matching = [], fromRecipient: Matching = []
    let current = start, useDonor = true
    while (true) {
      const next = (useDonor ? donorMate : recipientMate)[current]
      if (next < 0) break
      ;(useDonor ? fromDonor : fromRecipient).push([current, next])
      current = next
      useDonor = !useDonor
    }
    if (useDonor) continue
    const donorKeys = new Set(fromDonor.map(key)), recipientKeys = new Set(fromRecipient.map(key))
    const nextDonor = donor.filter((team) => !donorKeys.has(key(team)))
    const nextRecipient = recipient.filter((team) => !recipientKeys.has(key(team)))
    donor.splice(0, donor.length, ...nextDonor, ...fromRecipient)
    recipient.splice(0, recipient.length, ...nextRecipient, ...fromDonor)
    return
  }
  // This cannot occur for matchings with donor.length > recipient.length.
  throw new Error('Invalid partnership color transfer.')
}

/** Shape one complete edge partition into an optional first partial matching,
 * full matchings, and an optional last partial matching. All original circle
 * factors are reduced to the full-round target. Added empty color classes
 * receive the surplus, including the short boundary groups.
 */
function shapeCycle(count: number, capacity: number, firstSize: number, random: () => number): Matching[] {
  const edgeCount = count * (count - 1) / 2
  const originals = shuffled(factors(count), random)
  const fullCount = Math.floor((edgeCount - firstSize) / capacity)
  const lastSize = (edgeCount - firstSize) % capacity
  const first: Matching = [], last: Matching = []
  const additionalFull = Array.from({ length: fullCount - originals.length }, () => [] as Matching)
  const recipients = [
    ...(firstSize ? [{ teams: first, target: firstSize }] : []),
    ...additionalFull.map((teams) => ({ teams, target: capacity })),
    ...(lastSize ? [{ teams: last, target: lastSize }] : []),
  ]
  let donorIndex = 0
  for (const recipient of recipients) {
    while (recipient.teams.length < recipient.target) {
      while (originals[donorIndex].length === capacity) donorIndex += 1
      transfer(originals[donorIndex], recipient.teams, count)
    }
  }
  return [
    ...(firstSize ? [first] : []),
    ...shuffled([...originals, ...additionalFull], random),
    ...(lastSize ? [last] : []),
  ]
}

/**
 * Construct full rounds of disjoint partnership teams without packing search.
 * Each consecutive N(N−1)/2 teams in the flattened result is exactly one K_n
 * partnership rotation. Adjacent rotations share at most their boundary round.
 * This deliberately leaves opponent pairing to the caller; on a boundary round
 * pair the two even-sized rotation segments separately to retain game order.
 *
 * The two-color transfers take O(N) each and at most O(N²) transfers per
 * rotation, so construction is O(rotations * N³), with O(N²) working storage
 * in addition to the returned plan. The minimum necessary rotation count is
 * courts / gcd(courts, N(N−1)/4). No retries or probabilistic success condition.
 */
export function buildAmericanoPartnerships(count: number, courts: number, seed: number): Matching[] {
  if (!Number.isInteger(count) || count < 4 || (count % 4 !== 0 && count % 4 !== 1)) {
    throw new Error('Exact partnership rotations require 4k or 4k+1 players, with at least four players.')
  }
  if (!Number.isInteger(courts) || courts < 1 || courts > Math.floor(count / 4)) {
    throw new Error('Partnership scheduling requires a valid number of playable courts.')
  }
  const random = randomGenerator(seed)
  const capacity = courts * 2
  const edgeCount = count * (count - 1) / 2
  const rotations = capacity / gcd(capacity, edgeCount)
  const labels = Array.from({ length: count }, (_, index) => index)
  const result: Matching[] = []
  let carry: Matching = []

  for (let rotation = 0; rotation < rotations; rotation += 1) {
    const firstSize = carry.length ? capacity - carry.length : 0
    const groups = shapeCycle(count, capacity, firstSize, random)
    const assigned = new Map<number, number>()
    if (firstSize) {
      const occupied = new Set(carry.flat())
      const free = shuffled(labels.filter((label) => !occupied.has(label)), random)
      groups[0].flat().forEach((label, index) => assigned.set(label, free[index]))
    }
    const used = new Set(assigned.values())
    const remaining = shuffled(labels.filter((label) => !used.has(label)), random)
    let next = 0
    for (const label of labels) if (!assigned.has(label)) assigned.set(label, remaining[next++])
    const relabelled = groups.map((group) => group.map(([a, b]) => [assigned.get(a)!, assigned.get(b)!] as AmericanoPartnership))

    if (carry.length) {
      result.push([...carry, ...relabelled.shift()!])
      carry = []
    }
    for (const group of relabelled) {
      if (group.length === capacity) result.push(group)
      else carry = group
    }
  }
  if (carry.length) throw new Error('Partnership rotations ended with an incomplete round.')
  return result
}

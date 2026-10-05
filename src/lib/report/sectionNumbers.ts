/** Numbers only the sections that are included. Excluded slots stay 0. */
export function includedNumbers(flags: boolean[]): number[] {
  let n = 0;
  return flags.map((on) => (on ? ++n : 0));
}

export function majorTitle(n: number, title: string): string {
  return n > 0 ? `${n}.0 ${title}` : title;
}

export function subTitle(parent: number, child: number, title: string): string {
  if (parent < 1 || child < 1) return title;
  return `${parent}.${child} ${title}`;
}

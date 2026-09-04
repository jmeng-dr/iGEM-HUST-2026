/* The team roster.
 *
 * Source: the team's own member list (31 people, each with a portrait already
 * uploaded to static.igem.wiki). Display names are the initials the team has
 * published so far — full names are still pending the team's decision on public
 * attribution, so they are NOT invented here.
 *
 * `contribution` is deliberately left as a placeholder for anyone whose actual
 * contribution has not been written down yet. Do not fill these in with plausible
 * guesses; they are a judging artifact and have to come from the person.
 */

export interface Member {
  /** matches the portrait filename on static.igem.wiki */
  id: string;
  /** display name — initials until the team publishes full names */
  name: string;
  role: string;
  contribution: string;
  quote: string;
}

const PHOTO_BASE = 'https://static.igem.wiki/teams/6284/wiki/members/';
export const photoFor = (id: string) => `${PHOTO_BASE}${id}.avif`;

const TODO = 'Contribution pending — to be written by this team member.';

/* Dry Lab: the modelling work itself is documented and real (see Project: Model),
   but which person did which section has not been published, so the areas are
   named without claiming an assignment. */
const DRY_LAB_NOTE =
  'Modelling — optical (§1), synthetic-biology (§2) and protein (§3) work documented on Project: Model. Per-person attribution pending.';

export const WET_LAB: Member[] = [
  'gjy', 'nk', 'zly', 'zhx', 'wh', 'zsj', 'zsz', 'yyt', 'wzd', 'whj', 'xxm',
].map((id) => ({ id, name: id.toUpperCase(), role: 'Wet Lab', contribution: TODO, quote: '' }));

export const DRY_LAB: Member[] = [
  'wyx', 'szx', 'slc', 'ldd', 'ytx', 'zyy', 'zwt', 'zy',
].map((id) => ({ id, name: id.toUpperCase(), role: 'Dry Lab', contribution: DRY_LAB_NOTE, quote: '' }));

export const HUMAN_PRACTICES: Member[] = [
  'yzh', 'cyl', 'wjr', 'nhr', 'xhp', 'myc', 'zwh',
].map((id) => ({ id, name: id.toUpperCase(), role: 'Human Practices', contribution: TODO, quote: '' }));

export const ADVISORS: Member[] = [
  'hyh', 'yar', 'yyj',
].map((id) => ({ id, name: id.toUpperCase(), role: 'Advisor', contribution: TODO, quote: '' }));

export const PIS: Member[] = [
  { id: 'anna', name: 'Anna', role: 'Principal Investigator', contribution: TODO, quote: '' },
  { id: 'wbh', name: 'WBH', role: 'Principal Investigator', contribution: TODO, quote: '' },
];

export const TOTAL =
  WET_LAB.length + DRY_LAB.length + HUMAN_PRACTICES.length + ADVISORS.length + PIS.length;

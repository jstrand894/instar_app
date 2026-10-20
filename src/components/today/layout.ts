/** The Today cards you can turn on or off (the pencil at the top right). */
export const TODAY_CARDS = [
  { id: 'weather', label: 'Weather', hint: 'Conditions and a 5-day forecast' },
  { id: 'started', label: 'Getting started', hint: 'The first-steps checklist' },
  { id: 'focus', label: 'Focus now', hint: 'The few things that matter most right now' },
  { id: 'day', label: 'Your day', hint: 'Events, routines and what is coming up' },
  { id: 'add', label: 'Quick add', hint: 'One box for to-dos, deadlines and updates' },
  { id: 'pinned', label: 'Pinned projects', hint: 'Projects you pinned, ready to pick up' },
  { id: 'deadlines', label: 'Deadlines', hint: 'Due in the next three weeks' },
  { id: 'todos', label: 'To-dos', hint: 'Open tasks across every project' },
  { id: 'progress', label: 'Progress chart', hint: 'Updates, tasks and reading over time' },
  { id: 'completed', label: 'Completed today', hint: 'Tasks, routines and papers you finished today' },
  { id: 'time', label: 'Focus time', hint: 'This week from the timer' },
  { id: 'reading', label: 'Reading now', hint: 'Papers you are in the middle of' },
  { id: 'attention', label: 'Needs attention', hint: 'Projects with no update in two weeks' },
  { id: 'activity', label: 'Recent activity', hint: 'The latest updates and pushes' },
  { id: 'picture', label: 'Picture of the day', hint: "NASA's Astronomy Picture of the Day" },
] as const

/** How each card lays out: full width, the two-up row at the top, or a tile in a grid; and which labelled group it belongs to. */
export const CARD_META: Record<string, { shape: 'full' | 'top' | 'grid'; group?: string }> = {
  weather: { shape: 'full' }, started: { shape: 'full' }, focus: { shape: 'top' }, day: { shape: 'top' }, pinned: { shape: 'full' }, add: { shape: 'full' },
  deadlines: { shape: 'grid', group: 'Plan ahead' }, todos: { shape: 'grid', group: 'Plan ahead' },
  progress: { shape: 'full', group: 'Progress' }, completed: { shape: 'grid', group: 'Progress' }, time: { shape: 'grid', group: 'Progress' }, reading: { shape: 'grid', group: 'Progress' },
  attention: { shape: 'grid', group: 'Keep an eye on' }, activity: { shape: 'grid', group: 'Keep an eye on' }, picture: { shape: 'grid', group: 'Keep an eye on' },
}

/** Card ids in the order you chose; anything you haven't placed keeps its default spot after the others. */
export function orderedIds(order: string[]): string[] {
  const all = TODAY_CARDS.map(c => c.id as string)
  const mine = order.filter(id => all.includes(id))
  const out = [...mine]
  all.forEach((id, i) => { // a card you haven't placed goes right after the card that precedes it by default
    if (out.includes(id)) return
    const prev = i > 0 ? out.indexOf(all[i - 1]) : -1
    out.splice(prev + 1, 0, id)
  })
  return out
}

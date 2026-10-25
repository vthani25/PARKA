import { matchCommand } from '../matchCommand';

describe('matchCommand', () => {
  it.each([
    ['go home', 'go_home'],
    ['Open medications', 'open_medications'],
    ['open my medication please', 'open_medications'],
    ['add a medication', 'add_medication'],
    ['new pill', 'add_medication'],
    ['open check-in', 'open_checkin'],
    ['daily check in', 'open_checkin'],
    ['show hospital card', 'show_hospital_card'],
    ['open settings', 'open_settings'],
    ["I'm awake", 'im_awake'],
    ['I am awake', 'im_awake'],
    ['log a dose', 'log_dose'],
    ['I took my pills', 'log_dose'],
    ['I’m awake', 'im_awake'],
    ['hello can you open my medications please', 'open_medications'],
    ['okay take me home now', 'go_home'],
    ['I want to add a new medication', 'add_medication'],
    ['hey Parka show me my hospital card', 'show_hospital_card'],
  ])('"%s" -> %s', (said, action) => {
    expect(matchCommand(said)?.action).toBe(action);
  });

  it.each(['', 'banana', 'what is the weather', 'please', 'card', 'open', 'hello', 'hello I am finished'])('refuses unclear speech: "%s"', (said) => {
    expect(matchCommand(said)).toBeNull();
  });

  it('marks actions that change data so they are read back first', () => {
    expect(matchCommand('log a dose')?.changesData).toBe(true);
    expect(matchCommand("I'm awake")?.changesData).toBe(true);
    expect(matchCommand('open settings')?.changesData).toBe(false);
  });
});

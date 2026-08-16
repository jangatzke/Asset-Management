import { getAllowedIncidentTransitions } from '../../../shared/src/incidentTransitions';

describe('Incident status-transition dropdown (UI parity with backend matrix)', () => {
  it('does not offer `new` as a target from `contained` (the reported UX bug)', () => {
    const targets = getAllowedIncidentTransitions('contained');
    expect(targets.sort()).toEqual(['resolved', 'under_investigation']);
    expect(targets).not.toContain('new');
  });

  it('offers all valid targets from `new`', () => {
    expect(getAllowedIncidentTransitions('new').sort()).toEqual(['contained', 'resolved', 'under_investigation']);
  });

  it('offers all valid targets from `under_investigation` (including back to `new`)', () => {
    expect(getAllowedIncidentTransitions('under_investigation').sort()).toEqual(['contained', 'new', 'resolved']);
  });

  it('offers no targets from terminal statuses (resolved / closed)', () => {
    expect(getAllowedIncidentTransitions('resolved')).toEqual([]);
    expect(getAllowedIncidentTransitions('closed')).toEqual([]);
  });

  it('never offers the current status as a target', () => {
    for (const status of ['new', 'under_investigation', 'contained']) {
      expect(getAllowedIncidentTransitions(status)).not.toContain(status);
    }
  });
});

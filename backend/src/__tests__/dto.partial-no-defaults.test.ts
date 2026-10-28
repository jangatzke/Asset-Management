import { UpdateIncidentSchema, UpdateContractSchema, UpdateBusinessProcessSchema } from '../../../shared/src';

// Regression guard for the zod 3 -> 4 upgrade: in zod 4, `.default(...)` values
// are STILL applied inside optional fields after `.partial()`. These update DTOs
// must therefore re-declare defaulted base fields as plain `.optional()` so a
// partial PATCH body never injects defaults that would overwrite stored DB data.
describe('update DTOs do not inject zod-4 defaults on partial bodies', () => {
  it('UpdateIncidentSchema parses only the supplied field (no impact/severity defaults)', () => {
    const parsed = UpdateIncidentSchema.parse({ title: 'Only title changed' });

    expect(parsed).toEqual({ title: 'Only title changed' });
    // Explicitly assert the previously-defaulted fields are absent.
    expect(parsed).not.toHaveProperty('severity');
    expect(parsed).not.toHaveProperty('confidentialityImpact');
    expect(parsed).not.toHaveProperty('affectedAssetIds');
    expect(parsed).not.toHaveProperty('personalDataImpact');
  });

  it('UpdateContractSchema parses only the supplied field (no status default)', () => {
    const parsed = UpdateContractSchema.parse({ title: 'Renamed contract' });

    expect(parsed).toEqual({ title: 'Renamed contract' });
    expect(parsed).not.toHaveProperty('status');
  });

  it('UpdateBusinessProcessSchema parses only the supplied field (no siac/criticality/status defaults)', () => {
    const parsed = UpdateBusinessProcessSchema.parse({ name: 'Renamed process' });

    expect(parsed).toEqual({ name: 'Renamed process' });
    expect(parsed).not.toHaveProperty('siacControlled');
    expect(parsed).not.toHaveProperty('criticality');
    expect(parsed).not.toHaveProperty('status');
  });
});

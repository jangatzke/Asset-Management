import { UpdateAssetSchema } from '../../../shared/src';

describe('asset DTO contract', () => {
  it('normalizes optional empty relationship ids from asset edit forms', () => {
    const parsed = UpdateAssetSchema.parse({
      assetSubtypeId: '',
      organizationUnitId: '',
      locationId: '',
      technicalOperatorId: '',
      businessOwnerId: '',
      informationSecurityResponsibleId: '',
    });

    expect(parsed).toEqual({
      assetSubtypeId: undefined,
      organizationUnitId: undefined,
      locationId: undefined,
      technicalOperatorId: undefined,
      businessOwnerId: undefined,
      informationSecurityResponsibleId: undefined,
    });
  });
});

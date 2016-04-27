const should = require('should');
const Organisation = require('../../../api/models/organisation');

describe('Organisation', () => {
  before(clearDB)

  afterEach(clearDB)

  describe('trials', () => {
    it('returns trials related to the organisation', () => {
      let trialId;

      return factory.create('trialWithRelated')
        .then((trial) => {
          trialId = trial.id;
          const organisationId = toJSON(trial).organisations[0].attributes.id;
          return new Organisation({ id: organisationId }).fetch({ withRelated: 'trials' });
        }).then((organisation) => {
          const trialsIds = organisation.related('trials').models.map((trial) => trial.id);
          should(trialsIds).containEql(trialId);
        })
    })
  });

});

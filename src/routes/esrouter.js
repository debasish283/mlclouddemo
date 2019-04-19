const router = require("express").Router();
const wrapper = require("../controller");

//elasticsearch API's
router.delete("/deleteElasticSearchIndex/:indexName", wrapper.esController.deleteElasticSearchIndex);
router.post("/luceneSearch", wrapper.esController.luceneSearch);
router.post("/createElasticSearchIndex", wrapper.esController.createElasticSearchIndex)
router.get("/checkConnection", wrapper.esController.checkConnection)
router.post("/execute", wrapper.esController.execute)
router.post("/hardwareQuery", wrapper.esController.hardwareQuery)
router.post("/cpuMetricQuery", wrapper.esController.cpuMetricQuery)
router.post("/ramMetricQuery", wrapper.esController.ramMetricQuery)

module.exports = router;

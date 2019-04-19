import elasticsearch from "elasticsearch";
import fs from "fs";
import request from "request";
import _ from "lodash";
import moment from "moment";

let elasticClient = new elasticsearch.Client({
  host: process.env.ELASTICSEARCH_HOST
})

let esController = {
  deleteElasticSearchIndex: (req, res) => {
    elasticClient.indices.delete({
      index: req.params.indexName
    }).then((resp) => {
      res.status(200).send(resp)
    }).catch((err) => {
      res.status(500).send(err)
    })
  },
  createElasticSearchIndex: (req, res) => {
    elasticClient.indices.create({
      index: req.body.indexName
    }).then((resp) => {
      res.status(200).send(resp)
    }).catch((err) => {
      res.status(500).send(err)
    })
  },
  checkConnection: (req, res) => {
    elasticClient.ping({
    // ping usually has a 3000ms timeout
    requestTimeout: 1000
    }, function (error) {
    if (error) {
      res.send('elasticsearch cluster is down!');
    } else {
      res.send('All is well');
    }
    });
  },

  luceneSearch: (req, res) => {
    // console.log(`"${req.body.query}"`);
    elasticClient.search({
        index: 'eventlog-data',
        type: 'doc',
        body: {
          "query": {
            bool: {
              must: [
                {
                  query_string: {
                    query: `"${req.body.query}"`
                  }
                }
              ]
            }
          }
        }
    }).then((resp) => {
        res.send(resp)
    }, (err) => {
        res.status(500).send(err)
    });

  },
  execute: (req, res) => {
    elasticClient.search({
      index: req.body.index,
      body: req.body.query
    }).then((resp) => {
        res.send(resp)
    }, (err) => {
        res.status(500).send(err)
    });
  },
  hardwareQuery: (req, res) => {
    elasticClient.search({
      index: "staticinfo*",
      body: {
        "size": 1,
        "_source": ["SystemFamily", "Manufacturer", "Domain"],
        "query": {
          "bool": {
            "filter": {
              "term": {
                "deviceuniqueName.keyword": req.body.laptop
              }
            },
            "must": [
              {
                "match": {
                  "monitorName.keyword": "ComputerSystemMonitor"
                }
              },
              {
                "range": {
                  "timestamp": {
                    "gte": req.body.gte,
                    "lt": req.body.lt
                  }
                }
              }
            ]
          }
        }
      }
    }).then((ComputerSystemMonitorResp) => {
      const gte = moment(req.body.gte);
      const lt = moment(req.body.lt);
      const diff = lt.diff(gte);
      const diffDuration = moment.duration(diff);
      let days = diffDuration.days()

      elasticClient.search({
        index: "performanceinfo*",
        body: {
          "size": days || 1,
          "_source": ["OSArchitecture", "Caption", "Version", "TotalVisibleMemorySize"],
          "query": {
            "bool": {
              "filter": {
                "term": {
                  "deviceuniqueName.keyword": req.body.laptop
                }
              },
              "must": [
                {
                  "match": {
                    "monitorName.keyword": "OperatingSystemMonitor"
                  }
                },
                {
                  "range": {
                    "timestamp": {
                      "gte": req.body.gte,
                      "lt": req.body.lt
                    }
                  }
                }
              ]
            }
          }
        }
      }).then((OperatingSystemMonitorResp) => {
        elasticClient.search({
          index: "performanceinfo*",
          body: {
            "size": 1,
            "_source": ["Name", "Architecture"],
            "query": {
              "bool": {
                "filter": {
                  "term": {
                    "deviceuniqueName.keyword": req.body.laptop
                  }
                },
                "must": [
                  {
                    "match": {
                      "monitorName.keyword": "ProcessorMonitor"
                    }
                  },
                  {
                    "range": {
                      "timestamp": {
                        "gte": req.body.gte,
                        "lt": req.body.lt
                      }
                    }
                  }
                ]
              }
            }
          }
        }).then((ProcessorMonitorResp) => {
          function getArchitecture(arch){
              if(arch == 0){
                return "x86";
              }
              if(arch == 1){
                return "MIPS";
              }
              if(arch == 2){
                return "Alpha";
              }
              if(arch == 3){
                return "PowerPC";
              }
              if(arch == 5){
                return "ARM";
              }
              if(arch == 6){
                return "ia64";
              }
              if(arch == 9){
                return "x64";
              }
          }
          let finalJson = {};
          let finalArr = [];
          OperatingSystemMonitorResp.hits.hits.map((obj) => {
            finalJson['Manufacturer'] = ComputerSystemMonitorResp.hits.hits[0]._source.Manufacturer;
            finalJson['Domain'] = ComputerSystemMonitorResp.hits.hits[0]._source.Domain;
            finalJson['ModelName'] = ComputerSystemMonitorResp.hits.hits[0]._source.SystemFamily;
            finalJson['ProcessorArchitecture'] = getArchitecture(ProcessorMonitorResp.hits.hits[0]._source.Architecture);
            finalJson['ProcessorName'] = ProcessorMonitorResp.hits.hits[0]._source.Name;
            finalJson['OSArchitecture'] = obj._source.OSArchitecture;
            finalJson['OSVersion'] = obj._source.Version;
            finalJson['RAM (GB)'] = Math.ceil(obj._source.TotalVisibleMemorySize/(1024*1024));
            finalJson['OSName'] = obj._source.Caption;

            finalArr.push(finalJson)
          })
            res.send(finalArr)
        })
      })
    }, (err) => {
        res.status(500).send(err)
    });
  },
  cpuMetricQuery: (req, res) => {
    elasticClient.search({
      index: "metricinfo*",
      body: {
        "size": 0,
        "query": {
          "bool": {
            "filter": {
              "range": {
                "timestamp": {
                  "gte": req.body.gte,
                  "lt": req.body.lt
                }
              }
            },
            "must": [
              {
                "match": {
                  "metricname": "*LoadPercentage*"
                }
              },
              {
                "match": {
                  "cid": `*.${req.body.laptop}`
                }
              }
            ]
          }
        },
        "aggs": {
          "timefilter": {
            "date_histogram": {
              "field": "@timestamp",
              "interval": "1h"
            },
            "aggs": {
              "CPULoad": {
                "avg": {
                  "field": "value"
                }
              }
            }
          }
        }
      }
    }).then((resp) => {
      let myArray = []
      resp.aggregations.timefilter.buckets.map((obj) => {
        let myObj = {}
        myObj['key_as_string'] = obj.key_as_string,
        myObj['key'] = obj.key,
        myObj['value'] = obj.CPULoad.value

        myArray.push(myObj)
      })
      res.send(myArray);
    }, (err) => {
        res.status(500).send(err)
    });
  },
  ramMetricQuery: (req, res) => {
    elasticClient.search({
      index: "metricinfo*",
      body: {
        "query": {
          "bool": {
            "must": [
              {
                "range": {
                  "@timestamp": {
                    "gte": req.body.gte,
                    "lt": req.body.lt
                  }
                }
              },
              {
                "term": {
                  "cid.keyword": {
                    "value": req.body.laptop
                  }
                }
              },
              {
                "bool": {
                  "should": [
                    {
                      "term": {
                        "metricname.keyword": {
                          "value": "FreePhysicalMemory"
                        }
                      }
                    },
                    {
                      "term": {
                        "metricname.keyword": {
                          "value": "TotalVisibleMemorySize"
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        "aggs": {
          "timefilter": {
            "date_histogram": {
              "field": "@timestamp",
              "interval": "1h"
            },
            "aggs": {
              "aggregated_field": {
                "terms": {
                  "field": "metricname.keyword"
                },
                "aggs": {
                  "aggregated_value": {
                    "avg": {
                      "field": "value"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }).then((resp) => {
      let myArray = []
      resp.aggregations.timefilter.buckets.map((obj) => {
        let myObj = {}
        myObj['key_as_string'] = obj.key_as_string,
        myObj['key'] = obj.key
        if(obj.aggregated_field.buckets.length > 0) {
          myObj['value'] = 100 * obj.aggregated_field.buckets[0].aggregated_value.value/obj.aggregated_field.buckets[1].aggregated_value.value
        }
        else {
          myObj['value'] = 0;
        }
        myArray.push(myObj)
      })
      res.send(myArray);
    }, (err) => {
        res.status(500).send(err)
    });
  }
}

export default esController;

var sinon = require('sinon')
var test = require('tape')
var FeatureService = require('../')
var nock = require('nock')
var fs = require('fs')
var zlib = require('zlib')

var service = new FeatureService('http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1', {objectIdField: 'OBJECTID'})

var layerInfo = JSON.parse(fs.readFileSync('./test/fixtures/layerInfo.json'))
var layerFixture = JSON.parse(fs.readFileSync('./test/fixtures/layer.json'))
var idFixture = JSON.parse(fs.readFileSync('./test/fixtures/objectIds.json'))
var countFixture = JSON.parse(fs.readFileSync('./test/fixtures/count.json'))
var securedFixture = JSON.parse(fs.readFileSync('./test/fixtures/secured.json'))

test('create a service with query strings in the parameters', function (t) {
  var serv = new FeatureService('http://koop.whatever.com/FeatureServer/2?f=json', {layer: '2?f=json'})
  t.equal(serv.layer.toString(), '2')
  t.equal(serv.url, 'http://koop.whatever.com/FeatureServer')
  t.end()
})

test('get the objectId', function (t) {
  var oid = service.getObjectIdField(layerInfo)
  t.equal(oid, 'ESRI_OID')

  t.end()
})

test('build offset pages', function (t) {
  var pages
  var stats = {min: 0, max: 2000}
  pages = service._rangePages(stats, stats.max / 2)
  t.equal(pages[0].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&where=OBJECTID>=0+AND+OBJECTID<=999&f=json&outFields=*&geometry=&returnGeometry=true&geometryPrecision=')
  t.equal(pages[1].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&where=OBJECTID>=1000+AND+OBJECTID<=2000&f=json&outFields=*&geometry=&returnGeometry=true&geometryPrecision=')
  t.equal(pages.length, 2)
  pages = service._rangePages(stats, stats.max / 4)
  t.equal(pages.length, 4)
  t.end()
})

test('build id based pages', function (t) {
  var ids = [0, 1, 2, 3, 4, 5]
  var maxCount = 2
  var pages = service._idPages(ids, maxCount)
  t.equal(pages.length, 3)
  t.equal(pages[0].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&where=OBJECTID >= 0 AND OBJECTID<=1&f=json&outFields=*&geometry=&returnGeometry=true&geometryPrecision=10')
  t.equal(pages[1].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&where=OBJECTID >= 2 AND OBJECTID<=3&f=json&outFields=*&geometry=&returnGeometry=true&geometryPrecision=10')
  t.equal(pages[2].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&where=OBJECTID >= 4 AND OBJECTID<=5&f=json&outFields=*&geometry=&returnGeometry=true&geometryPrecision=10')
  t.end()
})

test('build result offset pages', function (t) {
  var maxCount = 100
  var pages = service._offsetPages(4, maxCount)
  t.equal(pages[0].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&f=json&outFields=*&where=1=1&resultOffset=0&resultRecordCount=100&geometry=&returnGeometry=true&geometryPrecision=')
  t.equal(pages[1].req, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?outSR=4326&f=json&outFields=*&where=1=1&resultOffset=100&resultRecordCount=100&geometry=&returnGeometry=true&geometryPrecision=')
  t.equal(pages.length, 4)

  t.end()
})

test('creates an out statistics url', function (t) {
  var url = service._statsUrl('test', ['min', 'max'])
  t.equal(url, 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?f=json&outFields=&outStatistics=[{"statisticType":"min","onStatisticField":"test","outStatisticFieldName":"min_test"},{"statisticType":"max","onStatisticField":"test","outStatisticFieldName":"max_test"}]')
  t.end()
})

test('get the metadata for a layer on the service', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, layerFixture)
  })
  service.layerInfo(function (err, metadata) {
    t.equal(err, null)
    t.equal(service.request.calledWith('http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1?f=json'), true)
    service.request.restore()
    t.end()
  })
})

test('get all the object ids for a layer on the service', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, idFixture)
  })
  service.layerIds(function (err, metadata) {
    t.equal(err, null)
    var expected = 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?where=1=1&returnIdsOnly=true&f=json'
    t.equal(service.request.calledWith(expected), true)
    service.request.restore()
    t.end()
  })
})

test('get the feature count for a layer on the service', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, countFixture)
  })
  service.featureCount(function (err, metadata) {
    t.equal(err, null)
    var expected = 'http://koop.dc.esri.com/socrata/seattle/2tje-83f6/FeatureServer/1/query?where=1=1&returnCountOnly=true&f=json'
    t.equal(service.request.calledWith(expected), true)
    service.request.restore()
    t.end()
  })
})

test('get a json error when trying to get a feature count', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, securedFixture)
  })
  service.featureCount(function (err, count) {
    t.notEqual(typeof err, 'undefined')
    t.equal(err.code, 499)
    t.equal(err.body.message, 'Token Required')
    service.request.restore()
    t.end()
  })
})

test('get an error with no response body when trying to get a feature count', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(new Error(), null)
  })
  service.featureCount(function (err, count) {
    t.equal(err.code, 500)
    service.request.restore()
    t.end()
  })
})

test('get a json error when trying to get layer ids', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, securedFixture)
  })
  service.layerIds(function (err, count) {
    t.notEqual(typeof err, 'undefined')
    t.equal(err.code, 499)
    t.equal(err.body.message, 'Token Required')
    service.request.restore()
    t.end()
  })
})

test('get an error with no response body when trying to get layer ids', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(new Error(), null)
  })
  service.layerIds(function (err, count) {
    t.equal(err.code, 500)
    service.request.restore()
    t.end()
  })
})

test('get a json error when trying to get layer info', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, securedFixture)
  })
  service.layerInfo(function (err, count) {
    t.notEqual(typeof err, 'undefined')
    t.equal(err.code, 499)
    t.equal(err.body.message, 'Token Required')
    service.request.restore()
    t.end()
  })
})

test('get an error with no response body when trying to get layer info', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(new Error(), null)
  })
  service.layerInfo(function (err, count) {
    t.equal(err.code, 500)
    service.request.restore()
    t.end()
  })
})

test('get a json error when trying to get statistics', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(null, securedFixture)
  })
  service.statistics('foo', ['max'], function (err, count) {
    t.notEqual(typeof err, 'undefined')
    t.equal(err.code, 499)
    t.equal(err.body.message, 'Token Required')
    service.request.restore()
    t.end()
  })
})

test('get an error with no response body when trying to get statistics', function (t) {
  sinon.stub(service, 'request', function (url, callback) {
    callback(new Error(), null)
  })
  service.statistics('foo', [], function (err, count) {
    t.equal(err.code, 500)
    service.request.restore()
    t.end()
  })
})

test('time out when there is no response', function (t) {
  var error
  service.timeOut = 5
  nock('http://www.timeout.com').get('/').socketDelay(100).reply({}.toString())

  service.request('http://www.timeout.com', function (err, data) {
    error = err
  })
  setTimeout(function () {
    t.equal(typeof error, 'object')
    service.timeOut = 1000
    t.end()
  }, 25)
})

test('decoding something that is gzipped', function (t) {
  var json = JSON.stringify(JSON.parse(fs.readFileSync('./test/fixtures/uncompressed.json')))
  zlib.gzip(json, function (err, gzipped) {
    t.error(err)
    var data = [gzipped]
    var res = {headers: {'content-encoding': 'gzip'}}
    var service = new FeatureService('http://service.com/mapserver/2')

    service._decode(res, data, function (error, json) {
      t.equal(error, null)
      t.equal(json.features.length, 2000)
      t.end()
    })
  })
})

test('decoding something that is deflated', function (t) {
  var json = JSON.stringify(JSON.parse((fs.readFileSync('./test/fixtures/uncompressed.json'))))
  zlib.deflate(json, function (err, deflated) {
    t.error(err)
    var data = [deflated]
    var res = {headers: {'content-encoding': 'deflate'}}

    service._decode(res, data, function (error, json) {
      t.equal(error, null)
      t.equal(json.features.length, 2000)
      t.end()
    })
  })
})

test('decoding something that is not compressed', function (t) {
  var uncompressed = JSON.stringify(JSON.parse(fs.readFileSync('./test/fixtures/uncompressed.json')))
  var data = [new Buffer(uncompressed)]
  var res = {headers: {}}

  service._decode(res, data, function (err, json) {
    t.error(err)
    t.equal(json.features.length, 2000)
    t.end()
  })
})

test('decoding an empty response', function (t) {
  var empty = []
  var res = {headers: {'content-encoding': 'gzip'}}

  service._decode(res, empty, function (err, json) {
    t.notEqual(typeof err, 'undefined')
    t.end()
  })
})

test('decoding an unexpected HMTL response', function (t) {
  var res = {headers: {'content-encoding': ''}}
  var data = [new Buffer('</html></html>')]
  service._decode(res, data, function (err) {
    t.equal(err.message, 'Received HTML or plain text when expecting JSON')
    t.end()
  })
})

test('decoding an unexpected plain text response', function (t) {
  var res = {headers: {'content-encoding': ''}}
  var data = [new Buffer('Bad request')]
  service._decode(res, data, function (err) {
    t.equal(err.message, 'Received HTML or plain text when expecting JSON')
    t.end()
  })
})

test('should trigger catchErrors with an error when receiving json with an error in the response', function (t) {
  var data = {
    error: {
      code: 400,
      message: 'Invalid or missing input parameters.',
      details: []
    }
  }

  var fixture = nock('http://www.error.com')
  fixture.get('/').reply(200, JSON.stringify(data))

  sinon.stub(service, '_catchErrors', function (task, err, url, callback) {
    callback(err)
  })

  var task = {req: 'http://www.error.com'}

  service._requestFeatures(task, function (err, data) {
    t.notEqual(typeof err, 'undefined')
    t.equal(err.body.code, 400)
    t.equal(err.body.message, 'Invalid or missing input parameters.')
    service._catchErrors.restore()
    t.end()
  })
})

// feature request integration tests
test('requesting a page of features', function (t) {
  var page = fs.readFileSync('./test/fixtures/page.json')
  var fixture = nock('http://servicesqa.arcgis.com')

  fixture.get('/97KLIFOSt5CxbiRI/arcgis/rest/services/QA_data_simple_point_5000/FeatureServer/0/query?outSR=4326&f=json&outFields=*&where=1=1&resultOffset=1000&resultRecordCount=1000&geometry=&returnGeometry=true&geometryPrecision=')
  .reply(200, page)

  var service = new FeatureService('http://servicesqa.arcgis.com/97KLIFOSt5CxbiRI/arcgis/rest/services/QA_data_simple_point_5000/FeatureServer/0')
  var task = {req: 'http://servicesqa.arcgis.com/97KLIFOSt5CxbiRI/arcgis/rest/services/QA_data_simple_point_5000/FeatureServer/0/query?outSR=4326&f=json&outFields=*&where=1=1&resultOffset=1000&resultRecordCount=1000&geometry=&returnGeometry=true&geometryPrecision='}

  service._requestFeatures(task, function (err, json) {
    t.equal(json.features.length, 1000)
    t.end()
  })
})

// paging integration tests
test('building pages for a service that supports pagination', function (t) {
  var countPaging = JSON.parse(fs.readFileSync('./test/fixtures/countPaging.json'))
  var layerPaging = JSON.parse(fs.readFileSync('./test/fixtures/layerPaging.json'))
  var fixture = nock('http://maps.indiana.edu')

  fixture.get('/ArcGIS/rest/services/Infrastructure/Railroads_Rail_Crossings_INDOT/MapServer/0/query?where=1=1&returnCountOnly=true&f=json')
  .reply(200, countPaging)

  fixture.get('/ArcGIS/rest/services/Infrastructure/Railroads_Rail_Crossings_INDOT/MapServer/0?f=json')
  .reply(200, layerPaging)

  var service = new FeatureService('http://maps.indiana.edu/ArcGIS/rest/services/Infrastructure/Railroads_Rail_Crossings_INDOT/MapServer/0', {})
  service.pages(function (err, pages) {
    t.equal(err, null)
    t.equal(pages.length, 156)
    t.end()
  })
})

test('building pages from a layer that does not support pagination', function (t) {
  var layerNoPaging = JSON.parse(fs.readFileSync('./test/fixtures/layerNoPaging.json'))
  var countNoPaging = JSON.parse(fs.readFileSync('./test/fixtures/countNoPaging.json'))
  var statsNoPaging = JSON.parse(fs.readFileSync('./test/fixtures/statsNoPaging.json'))
  var fixture = nock('http://maps2.dcgis.dc.gov')

  fixture.get('/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/50/query?where=1=1&returnCountOnly=true&f=json')
  .reply(200, countNoPaging)

  fixture.get('/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/50?f=json')
  .reply(200, layerNoPaging)

  fixture.get('/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/50/query?f=json&outFields=&outStatistics=%5B%7B%22statisticType%22:%22min%22,%22onStatisticField%22:%22OBJECTID_1%22,%22outStatisticFieldName%22:%22min_OBJECTID_1%22%7D,%7B%22statisticType%22:%22max%22,%22onStatisticField%22:%22OBJECTID_1%22,%22outStatisticFieldName%22:%22max_OBJECTID_1%22%7D%5D')
  .reply(200, statsNoPaging)

  var service = new FeatureService('http://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/50')
  service.pages(function (err, pages) {
    t.equal(err, null)
    t.equal(pages.length, 1)
    t.end()
  })
})

test('building pages from a layer where statistics fail', function (t) {
  var layerStatsFail = JSON.parse(fs.readFileSync('./test/fixtures/layerStatsFail.json'))
  var countStatsFail = JSON.parse(fs.readFileSync('./test/fixtures/countStatsFail.json'))
  var idsStatsFail = JSON.parse(fs.readFileSync('./test/fixtures/idsStatsFail.json'))
  var statsFail = JSON.parse(fs.readFileSync('./test/fixtures/statsFail.json'))
  var fixture = nock('http://maps2.dcgis.dc.gov')

  fixture.get('/dcgis/rest/services/FEEDS/CDW_Feeds/MapServer/8/query?where=1=1&returnIdsOnly=true&f=json')
  .reply(200, idsStatsFail)

  fixture.get('/dcgis/rest/services/FEEDS/CDW_Feeds/MapServer/8/query?where=1=1&returnCountOnly=true&f=json')
  .reply(200, countStatsFail)

  fixture.get('/dcgis/rest/services/FEEDS/CDW_Feeds/MapServer/8?f=json')
  .reply(200, layerStatsFail)

  fixture.get('/dcgis/rest/services/FEEDS/CDW_Feeds/MapServer/8/query?f=json&outFields=&outStatistics=%5B%7B%22statisticType%22:%22min%22,%22onStatisticField%22:%22ESRI_OID%22,%22outStatisticFieldName%22:%22min_ESRI_OID%22%7D,%7B%22statisticType%22:%22max%22,%22onStatisticField%22:%22ESRI_OID%22,%22outStatisticFieldName%22:%22max_ESRI_OID%22%7D%5D')
  .reply(200, statsFail)

  var service = new FeatureService('http://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/CDW_Feeds/MapServer/8')

  service.pages(function (err, pages) {
    t.equal(err, null)
    t.equal(pages.length, 4)
    t.end()
  })

})

test('building pages for a version 10.0 server', function (t) {
  var layer10 = JSON.parse(fs.readFileSync('./test/fixtures/layer10.0.json'))
  var ids10 = JSON.parse(fs.readFileSync('./test/fixtures/ids10.0.json'))
  var fixture = nock('http://sampleserver3.arcgisonline.com')

  fixture.get('/ArcGIS/rest/services/Fire/Sheep/FeatureServer/2?f=json').reply(200, layer10)

  fixture.get('/ArcGIS/rest/services/Fire/Sheep/FeatureServer/2/query?where=1=1&returnIdsOnly=true&f=json').reply(200, ids10)

  var service = new FeatureService('http://sampleserver3.arcgisonline.com/ArcGIS/rest/services/Fire/Sheep/FeatureServer/2')

  service.pages(function (err, pages) {
    t.equal(err, null)
    t.equal(pages.length, 1)
    t.end()
  })
})

test('service times out on third try for features', function (t) {
  var service = new FeatureService('http://www.foobar.com')
  service.timeOut = 5
  nock('http://www.foobar.com').get('/').socketDelay(100).reply({}.toString())
  sinon.stub(service, '_abortPaging', function (err, callback) {
    callback(err)
  })

  var task = {
    retry: 3,
    req: 'http://www.foobar.com/'
  }
  service._requestFeatures(task, function (err) {
    t.equal(err.code, 504)
    t.equal(err.url, 'http://www.foobar.com/')
    t.end()
  })
})

test('catching errors with a json payload', function (t) {
  var service = new FeatureService('http://service.com/mapserver/2')
  var task = { retry: 3 }
  var error = new Error('Request for a page of features failed')
  var body = {
    code: 400,
    message: 'Invalid or missing input parameters',
    details: []
  }
  error.body = body
  error.url = 'http://url.com'

  sinon.stub(service, '_abortPaging', function (error, cb) {
    cb(error)
  })

  service._catchErrors(task, error, error.url, function (info) {
    t.equal(info.message, 'Request for a page of features failed')
    t.equal(info.url, error.url)
    t.equal(info.body, body)
    service._abortPaging.restore()
    t.end()
  })

})


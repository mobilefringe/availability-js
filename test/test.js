var Availability = require("../availability.js");
var assert = require("assert");
var moment = require('moment');
var util = require('util');

process.env.TZ = 'Etc/UTC';

var seeds = {
  "threeDays" : require("./seeds/threeDays.json"),
  "fiveDays" : require("./seeds/fiveDays.json"),
  "threeDaysNumeric" : require("./seeds/threeDaysNumeric.json"),
  "testRegularHours" : require("./seeds/testRegularHours"),
  "testRegularHoursWithDates" : require("./seeds/testRegularHoursWithDates"),
  "testRegularHoursWithDatesTimeZone" : require("./seeds/testRegularHoursWithDatesTimeZone"),
  'test15MinuteInterval' : require("./seeds/test15MinuteInterval"),
  'testUnavailableForBlocks' : require("./seeds/testUnavailableForBlocks"),
  'testUnavailableForBlocksWithTimeZone' : require("./seeds/testUnavailableForBlocksWithTimeZone"),
  'testIncludeUnavailable' : require("./seeds/testIncludeUnavailable"),
  'testIncludeUnavailableNotes': require("./seeds/testIncludeUnavailableNotes"),
  'testUnavailableUntil': require("./seeds/testAvailableUntil"),
  'testLongHoursCrash' : require("./seeds/testLongHoursCrash"),
  'testRegularHoursFullDay': require("./seeds/testRegularHoursFullDay")
};

// test sunny case let's just test regular scheduled hours.
function testRegularHours(){
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  hours = av.getAvailability("2016-06-20", "2016-06-24");
  expected = seeds.testRegularHours;
  
  assert.deepEqual(hours, expected, "Times returned didn't match expected");
}

// test sunny case let's just test regular scheduled hours.
function testRegularHoursWithDates(){
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  hours = av.getAvailability("2016-06-20", "2016-06-24", {dates: true});
  expected = seeds.testRegularHoursWithDates;
  
  assert.deepEqual(hours, expected, "Times returned didn't match expected");
}

function testRegularHoursWithDatesTimeZone() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  hours = av.getAvailability("2016-06-20", "2016-06-24", {dates: true, timeZone: 'US/Pacific'});
  expected = seeds.testRegularHoursWithDatesTimeZone;
  
  assert.deepEqual(hours, expected, "Times returned didn't match expected");
  
}

function testNumericDays() {
  av = new Availability();
  av.setRegularHours(seeds.threeDaysNumeric);

  hours = av.getAvailability("2016-06-20", "2016-06-24");
  expected = seeds.testRegularHours;

  assert.deepEqual(hours, expected, "Times returned didn't match expected");
 }

// test setting an interval for 15 minutes passes
function test15MinuteInterval(){
  av = new Availability();
  av.setInterval(15);
  av.setRegularHours(seeds.threeDays);

  hours = av.getAvailability("2016-06-20", "2016-06-24");
  expected = seeds.test15MinuteInterval;
  assert.deepEqual(hours, expected, "Times returned didn't match expected");

}


// This test just tests the unvailable object to make sure it's working as we'd want it.
function testUnavailableSingleDay() {
  av = new Availability();

  av.addUnavailable('2016-06-01');
  unavailable = av.getUnavailable();

  // Assert that the date was added.
  assert.notEqual(unavailable['2016-06-01'], undefined);

  // Assert that there are 24 id's - 1 for each hour.
  assert.equal(Object.keys(unavailable['2016-06-01']).length, 24, 'Wrong number of keys detected for full day unavailability');

  // Assert that 5PM is marked as 17:00 start time and endtime: 18:00 end time.
  assert.equal(unavailable['2016-06-01']['17'][0]['start'].minute(), 0);
  assert.equal(unavailable['2016-06-01']['18'][0]['end'].minute(), 0);
}

// Test mixing unavaiable time use cases.
function testUnavailableRanges(){
  av = new Availability();

  // Unavailable from 1:30 PM - 1:45PM
  av.addUnavailable('2016-06-01 13:30', '2016-06-01 13:45');

  // Unavailable from 12PM - 2:30PM
  av.addUnavailable('2016-06-01 12:00', '2016-06-01 14:30');
  
  // Unavailable on the 3rd
  av.addUnavailable('2016-06-03');

  // Unavailable from the 9 12th at 2PM
  av.addUnavailable('2016-06-09', '2016-06-12 14:00');

  u = av.getUnavailable();

  // Test that on the first between 1 - 2 there should only be a single result
  assert.equal(Object.keys(u['2016-06-01']['13']).length, 1, 'Expecting only 1 result for full hour break');

  // Test that the 10th and 11th are off
  assert.notStrictEqual(u['2016-06-10'], undefined);
  assert.notStrictEqual(u['2016-06-11'], undefined);

  // Test that there are 24 entries for both
  assert.equal(Object.keys(u['2016-06-10']).length, 24, 'Wrong number of keys detected for full day unavailability');
  assert.equal(Object.keys(u['2016-06-11']).length, 24, 'Wrong number of keys detected for full day unavailability');

  // Test that there is no unavailibity for 15:00 on the 12th
  assert.strictEqual(u['2016-06-12']['15'], undefined, 'Unexpected entry for time.');

  // Test that on the first the last unavailbity ends at 14:30
  assert.equal(u['2016-06-01']['14'][0]['end'].minute(), 30, 'Invalid end time.');
}

function testIsUnavailable() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  av.addUnavailable('2016-06-21');
  av.addUnavailable('2016-06-22 12:00', '2016-06-22 14:30');
  // Test that unavailable for day
  assert.equal(av.isUnavailableAt('2016-06-24'), false);
  assert.equal(av.isUnavailableAt('2016-06-21'), true);
  assert.equal(av.isUnavailableAt('2016-06-21 15:00'), true);
  assert.equal(av.isUnavailableAt('2016-06-22 13:00'), true);
  assert.equal(av.isUnavailableAt('2016-06-22 14:30'), false);
  assert.equal(av.isUnavailableAt('2016-06-22 12:15'), true);
  assert.equal(av.isUnavailableAt('2016-06-22 12:30'), true);
  assert.equal(av.isUnavailableAt('2016-06-22 11:45'), false);
  assert.equal(av.isUnavailableAt('2016-06-22 11:49'), false);
}

function testOutForDayAppointments() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  av.addUnavailable('2016-06-21');

  // Test out for day  
  hours = av.getAvailability("2016-06-21", "2016-06-24");
  assert.strictEqual(hours['2016-06-21'], undefined);
}

function testOutForDayAppointmentsWithTimeZone() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  var day = moment.tz('2016-06-21', 'US/Pacific');
  av.addUnavailable(day);

  // Test out for single day  
  hours = av.getAvailability("2016-06-21", "2016-06-24", {'timeZone': 'US/Pacific'});
  assert.strictEqual(hours['2016-06-21'], undefined, 'Hours found - should not be defined.');

}


function testOutForMultipleDaysWithTimeZones() {
  // Test Ranges
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  var startDay = moment.tz('2016-06-21', 'US/Pacific');
  var endDay = moment.tz('2016-06-23', 'US/Pacific');

  av.addUnavailable(startDay, endDay, 'Busy');

  hours = av.getAvailability("2016-06-21", "2016-06-24", {'timeZone': 'US/Pacific'});
  
  assert.strictEqual(hours['2016-06-21'], undefined, 'Hours found - should not be defined.');
  assert.strictEqual(hours['2016-06-22'], undefined, 'Hours found - should not be defined.');
  assert.strictEqual(hours['2016-06-23'], undefined, 'Hours found - should not be defined.');

}

function testUnavailableForBlock() {

  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  av.addUnavailable('2016-06-21 13:30', '2016-06-21 15:30');
  av.addUnavailable('2016-06-20 12:15', '2016-06-20 14:15');

  // Test out for day 
  hours = av.getAvailability("2016-06-20", "2016-06-24");

  // console.log(av.getUnavailableAt('2016-06-20 13:59'));
  assert.deepEqual(hours, seeds['testUnavailableForBlocks']);
}

function testUnavailableForBlockWithTimeZone() {

  av = new Availability();
  av.setRegularHours(seeds.threeDays);
  av.setIncludeUnavailable(true);

  av.addUnavailable('2016-06-21 13:30', '2016-06-21 15:30');
  av.addUnavailable('2016-06-20 12:15', '2016-06-20 14:15');
  av.addUnavailable(
    moment.tz('2016-06-21 13:30', 'US/Pacific'),
    moment.tz('2016-06-21 15:30', 'US/Pacific'));

  // Test out for day 
  hours = av.getAvailability("2016-06-20", "2016-06-24", 
    {
      'timeZone' : 'US/Pacific'
    }
  );

  assert.deepEqual(JSON.parse( JSON.stringify(hours)), 
                   JSON.parse( JSON.stringify(seeds['testUnavailableForBlocksWithTimeZone']) ));
}


function testIncludeUnavailable() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  av.addUnavailable('2016-06-21 13:30', '2016-06-21 15:30');
  av.addUnavailable('2016-06-20 12:15', '2016-06-20 14:15');
  av.setIncludeUnavailable(true);

  // Test out for day 
  hours = av.getAvailability("2016-06-20", "2016-06-24");
  assert.deepEqual(hours['2016-06-22'], seeds['testIncludeUnavailable']['2016-06-22']);
  
  assert.notEqual(hours['2016-06-20'][3]['unavailable'], undefined);
  assert.notEqual(hours['2016-06-20'][5]['unavailable'], undefined);
  assert.equal(hours['2016-06-20'][6]['unavailable'], undefined);
  assert.notEqual(hours['2016-06-21'][2]['unavailable'], undefined);
  
  av.setInterval(15);
  hours = av.getAvailability("2016-06-20", "2016-06-24");

  // Tests that if not available at 12:15 that 12:00 - 12:15 is still available.
  assert.equal(hours['2016-06-20'][12]['unavaiable'], undefined);
}

function testIncludeUnavailableNotes() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  // av.addUnavailable('2016-06-21 13:30', '2016-06-21 15:30', 'appointment');
  av.addUnavailable('2016-06-20 12:15', '2016-06-20 14:15', 'holiday');
  av.addUnavailable('2016-06-20 14:30', '2016-06-20 17:00', {'name': 'wtf brah'});
  av.setIncludeUnavailable(true);

  // Test out for day 
  hours = av.getAvailability("2016-06-20", "2016-06-24");

  assert.notEqual(hours['2016-06-20'][3]['unavailable'], undefined);
  assert.equal(hours['2016-06-20'][3]['unavailable'][0]['details'], 'holiday');
  assert.notEqual(hours['2016-06-20'][3]['unavailable'], undefined);
  assert.equal(hours['2016-06-20'][4]['unavailable'].length, 1);
  assert.equal(hours['2016-06-20'][5]['unavailable'].length, 2);
}

function testAvailableUntil() {

  av = new Availability();
  av.setRegularHours(seeds.threeDays);
  av.setInterval(15);

  av.addUnavailable('2016-06-20 11:15', '2016-06-20 13:15', 'holiday');
  av.addUnavailable('2016-06-20 15:30', '2016-06-20 16:30', {'name': 'wtf brah'});
  av.setIncludeUnavailable(true);

  hours = av.getAvailability("2016-06-20", "2016-06-24", {nextUnavailableAt: true});

  expected = seeds.testUnavailableUntil;
  assert.deepEqual(JSON.parse(JSON.stringify(hours)), expected, "Times returned didn't match expected");
}


function testLongHolidaysCrashCase() {
  process.env.TZ = 'America/Toronto';

  av = new Availability();
  av.setRegularHours(seeds.fiveDays);
  av.setIncludeUnavailable(true);
  av.setInterval(15);

  seeds.testLongHoursCrash.forEach(function(record){
    var startTime = moment(record.startDateTime);
    var endTime = moment(record.endDateTime);
    var details = {
        "_type" : 'scheduled',
        "details" : record
    };

    if (record.isFullDay) {
        av.addUnavailable(startTime.startOf('day'), endTime.endOf('day'), details);
    } else {
        av.addUnavailable(record.startDateTime, record.endDateTime, details);
    }

  });

  hours = av.getAvailability("2016-07-01", "2017-01-31", {availableUntil: true, dates: true});

  // Test that we got here without incident;
  assert(true);
  process.env.TZ = 'Etc/UTC';
}

function testRegularHoursFullDay() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  hours = av.getAvailability("2016-06-20", "2016-06-24", 
    {
      includeFullDay: true,
      dates: true
    }
  );

  expected = seeds.testRegularHoursFullDay;
  assert.deepEqual(hours, expected, "Times returned didn't match expected");

}

testRegularHours();
testNumericDays();
test15MinuteInterval();
testUnavailableSingleDay();
testUnavailableRanges();
testIsUnavailable();
testOutForDayAppointments();
testOutForDayAppointmentsWithTimeZone();
testUnavailableForBlock();
testUnavailableForBlockWithTimeZone();
testIncludeUnavailable();
testIncludeUnavailableNotes();
testRegularHoursWithDates();
testRegularHoursWithDatesTimeZone();
testAvailableUntil();
testLongHolidaysCrashCase();
testOutForMultipleDaysWithTimeZones();
testRegularHoursFullDay();
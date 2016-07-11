var Availability = require("../availability.js");
var assert = require("assert");
var moment = require('moment');
var util = require('util');

var seeds = {
  "threeDays" : require("./seeds/threeDays.json"),
  "threeDaysNumeric" : require("./seeds/threeDaysNumeric.json"),
  "testRegularHours" : require("./seeds/testRegularHours"),
  "testRegularHoursWithDates" : require("./seeds/testRegularHoursWithDates"),
  'test15MinuteInterval' : require("./seeds/test15MinuteInterval"),
  'testUnavailableForBlocks' : require("./seeds/testUnavailableForBlocks"),
  'testIncludeUnavailable' : require("./seeds/testIncludeUnavailable"),
  'testIncludeUnavailableNotes': require("./seeds/testIncludeUnavailableNotes")
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

  hours = av.getAvailability("2016-06-20", "2016-06-24", {returnDates: true});
  expected = seeds.testRegularHoursWithDates;
  console.log(expected);
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

  // Assert that 5PM is marked as 17:00 start time and endtime: 17:59 end time.
  assert.equal(unavailable['2016-06-01']['17'][0]['start'].minute(), 0);
  assert.equal(unavailable['2016-06-01']['17'][0]['end'].minute(), 59);
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
  
  // Test that unavailable for day
  assert.equal(av.isUnavailableAt('2016-06-24'), false);
  assert.equal(av.isUnavailableAt('2016-06-21'), true);
  assert.equal(av.isUnavailableAt('2016-06-21 15:00'), true);
}

function testOutForDayAppointments() {
  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  av.addUnavailable('2016-06-21');

  // Test out for day  
  hours = av.getAvailability("2016-06-21", "2016-06-24");
  assert.strictEqual(hours['2016-06-21'], undefined);
}

function testUnavailableForBlock() {

  av = new Availability();
  av.setRegularHours(seeds.threeDays);

  av.addUnavailable('2016-06-21 13:30', '2016-06-21 15:30');
  av.addUnavailable('2016-06-20 12:15', '2016-06-20 14:15');

  // Test out for day 
  hours = av.getAvailability("2016-06-20", "2016-06-24");
  
  assert.deepEqual(hours, seeds['testUnavailableForBlocks']);
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

testRegularHours();
testNumericDays();
test15MinuteInterval();
testUnavailableSingleDay();
testUnavailableRanges();
testIsUnavailable();
testOutForDayAppointments();
testUnavailableForBlock();
testIncludeUnavailable();
testIncludeUnavailableNotes();
testRegularHoursWithDates();
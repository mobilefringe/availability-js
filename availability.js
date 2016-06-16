var moment = require('moment');

// Guide to errors more as a reference.
errors = {
  "error.invalid_date_string" : "Invalid/Unsupported string date provided"
};

var Availability = function() {

  /**
   regularHours : {
      0 :  {start:StartTime, end:endTime}
      1 : {start:startTime, end:endTime}
   }
   **/

  this.regularHours = {};

  /**
   unvailable : {
    "2015-06-20" : 
      "09": [{start_time : end_time}]
      "10": [{start_time, end_time}]
   }
   **/
  this.unavailable = {};

  this.interval = 60;
  this.bufferTime = 0;
};

/**
 * Set regular operating hours from which to generate a schedule
 * @param {Object} hours - An hours hash with set days and times to generate availability for,.
 * @param {Object} hours.day - Where day is [Monday, Tuesday, Wednesday etc.] or day number [0-6]
 * @param {String} hours.day.start  - The start time in 24 hour format. ie. 09:00:00 for 9AM
 * @param {String} hours.day.end - The end time in 24 hour format. ie 17:00:00 for 5PM
 */
Availability.prototype.setRegularHours = function(regularHours) {
  var cleanedHours = {};

  for (key in regularHours) {

    var day = key;
    if (isNaN(key)) {
      day = Availability.getDateInt(key);
    }

    cleanedHours[day] = regularHours[key];
  }

  this.regularHours = cleanedHours;

  return this;
};

/**
 * Adds a time window in which the user the user is unavailable for a given date.
 * @param {String|Moment|Date} startTime  A string that can be parsed into a moment date time or a momemnt, or date object.
 * @param {String|Moment|Date} endTime  A string that can be parsed into a moment date time or a momemnt, or date object.
 */
Availability.prototype.addUnavailable = function(startTime, endTime) {
  startTime = moment(startTime);
  currentTime = moment(startTime);
  
  // If only a start time is given assume until end of day.
  if (endTime === undefined ) {
    endTime = moment(currentTime);
    endTime.endOf('day');
  } else {
    endTime = moment(endTime);
  }
 
  while (currentTime.isBefore(endTime)) {
    
    var dateKey = currentTime.format('Y-MM-DD');
    var hourKey = currentTime.format('H');
    var currentEndTime = moment(currentTime).endOf('hour');

    // If the current end time happens after this hour block,
    // set the currentEndTime to be currentTime's end of hour.
    if (endTime.isBefore(currentEndTime)) {
      currentEndTime = endTime;
    }
    
    if (this.unavailable[dateKey] === undefined) {
      this.unavailable[dateKey] = {};
    }

    if (this.unavailable[dateKey][hourKey] === undefined) {
      this.unavailable[dateKey][hourKey] = [];
    }

    // Convenience variable.
    var uValue = this.unavailable[dateKey][hourKey];

    // If this currentTime / endtime takes up the whole hour.
    // make it the first element and remove all others.
    if (uValue.length > 0 && currentTime.minute() === 0 && currentEndTime.minute() == 59) {
      uValue = [];
    } 

    uValue.push({
      'start' : moment(currentTime),
      'end' : moment(currentEndTime)
    });

    // @TODO could probably make this method more efficent by removing overlapping.
    // elements - this does cost this function more cycles though - so may not be as efficiant 
    // as we'd want.

    // Move current start time up by an hour.
    currentTime.add(1, 'hour').startOf('hour');
  }


  return this;
};

/**
 * Returns all time availability based on interval for a given timeframe.
 * @param {string} startDate - A date time that can be parsed by Moment.js
 * @param {string} endDate - A datetime that can be parsed by Moment.js
 * @return {Object} Returns a hash object between the start date and end date,
 *  with available times for each date.
 */
Availability.prototype.getAvailability = function(startDate, endDate) {
  startDate = moment(startDate);
  currentDate = moment(startDate);
  availableDateTimes = {};

  // Loop from the start/date time to enddate time.
  while (currentDate.isBefore(endDate)){
    // Check if the user has regular hours set for this date.
    var dayOfTheWeekKey = currentDate.format("d");
    var regularHours = null;

    if ((regularHours = this.regularHours[dayOfTheWeekKey]) === undefined) {
      // If no regular hours are set for this day, let's move forward 24 hours.
      currentDate.add(1, "d");
      continue;
    }
    
    // We have regular hours for this day so let's now do some processing.
    var dateKey = currentDate.format("Y-MM-DD");
    
    // Parse our regular hour times into times and start calculating time from the start time up until the end of the day.
    var startTime = moment(regularHours.start, "HH:mm");
    var endTime = moment(regularHours.end, "HH:mm");
    var endOfDay = moment(currentDate);
    
    currentDate.hour(startTime.hour()).minute(startTime.minute());
    endOfDay.hour(endTime.hour()).minute(endTime.minute());
        
    var times = [];
    
    while (currentDate.isBefore(endOfDay)) {

      // Test to see that there's no existing appointment at this time.
      if (this.isUnavailableAt(currentDate)) {
        currentDate.add(this.interval, 'm');
        continue;
      }

      var startFinish = {
        "start" : currentDate.format("HH:mm"),
        "end":  null
      };

      // Move the time forward to our end time.
      currentDate.add(this.interval, 'm');

      // Test to see that our end time doesn't overlap with any appointment either.
      if (this.isUnavailableAt(currentDate)) {
        currentDate.add(this.interval, 'm');
        continue;
      }

      // Add time to our availability.
      startFinish.end = currentDate.format("HH:mm");

      // Add time to our array of available times
      times.push(startFinish);
    }
    
    // If times is not empty let's add it to our array.
    if (times.length > 0) {
      availableDateTimes[dateKey] = times;
    }

    // Move time foward by a day.
    currentDate.add(1, 'd');
  }

  return availableDateTimes;

};

/**
 * Check to see if the user is available at a current date time.
 */
Availability.prototype.isUnavailableAt = function (date) {
  date = moment(date);

  dateKey = date.format('Y-MM-DD');
  hourKey = date.format('H');

  if (this.unavailable[dateKey] === undefined) 
    return false;
  
  if (this.unavailable[dateKey][hourKey] === undefined)
    return false;
  
  // Loop through the unavailable times and determine if the selected time is unavailable.
  for (var x in this.unavailable[dateKey][hourKey]) {
    // Convinience variable.
    var timeNotAvailable = this.unavailable[dateKey][hourKey][x];

    // if the start time falls between the start and end time then they are unavailable
    if (date.isBetween(timeNotAvailable['start'], timeNotAvailable['end'], 'minutes','[]')) {
      return true;
    }
  }

  // Nothings matched so false.
  return false;
};


/**
 * Sets interval
 * @param {int} The interval in minutes.
 * @throws {Error} throws error errors.invalid_interval if interval not a valid numeric value.
 */
Availability.prototype.setInterval = function(interval){ 
  
  if (isNaN(interval)) {
    throw new Error('errors.invalid_interval');
  }

  this.interval = parseInt(interval, 10);

  return this;
};

Availability.prototype.getUnavailable = function(){
  return this.unavailable;
};

/**
 * Static function that converts a String - monday, tuesday etc. to the int value of a date.
 * @param {string} The string to convert.
 * @throws Error.
 * @returns {int}
 */
Availability.getDateInt = function(day) {
  switch (day.toLowerCase()) {
    case 'sunday': return 0;
    case 'monday': return 1;
    case 'tuesday': return 2;
    case 'wednesday': return 3;
    case 'thursday': return 4;
    case 'friday': return 5;
    case 'saturday': return 6;
    default:
      throw new Error("error.invalid_date_string");
  }
};


module.exports = Availability;
var moment = require('moment-timezone');
var _ = require('underscore');

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

  // Sets whether or not include unavailable date/times in the returned results.
  this.includeUnavailable = false;

  // Track each unavailable time slot with an id - so that we can easily
  // track same unavailable time objects.
  this.unavailableId = 0;
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
Availability.prototype.addUnavailable = function(startTime, endTime, details) {
  this.unavailableId++;

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
    var currentEndTime = moment(currentTime).endOf('hour').add(1, 'second');

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
    if (uValue.length > 0 && currentTime.minute() === 0 && 
        (currentEndTime.minute() === 0 && currentEndTime.hour() == (currentTime.hour() + 1))) {
      this.unavailable[dateKey][hourKey] = [];
    } 
    
    this.unavailable[dateKey][hourKey].push({
      'start' : moment(currentTime),
      'end' : moment(currentEndTime),
      'details' : details,
      '__availabilityId' : this.unavailableId
    });

    // @TODO could probably make this method more efficent by removing overlapping.
    // elements - this does cost this function more cycles though - so may not be as efficiant 
    // as we'd want.
    var oldTime = moment(currentTime);
    
    // Move current start time up by an hour.
    currentTime.add(1, 'hour').startOf('hour');

    var newTime = moment(currentTime);

    // Hit our timezone bug.
    if (oldTime.isSame(newTime)) {
      currentTime.add(2, 'hour').startOf('hour');
    }
  }

  return this;
};

/**
 * Returns all time availability based on interval for a given timeframe.
 * @param {string} startDate - A date time that can be parsed by Moment.js
 * @param {string} endDate - A datetime that can be parsed by Moment.js
 * @param {Object}  options - Option boject
 * @param {boolean} options.dates - Return js date objects with the time array.
 * @param {boolean} options.nextUnavailableAt - Return iso string indicating when next unavailable time is.
 * @param {string}  options.timeZone - The timezone to adjust availability for.
 * @param {boolean} options.includeFullDay - Returns all time in a day, but marks availability time.
 * @return {Object} Returns a hash object between the start date and end date,
 *  with available times for each date.
 */
Availability.prototype.getAvailability = function(startDate, endDate, options) {

  var defaults = {
    'dates' : false,
    'nextUnavailableAt': false,
    'timeZone' : 'UTC',
    'includeFullDay' : false
  };

  options = _.extend(defaults, options);

  startDate = moment.tz(startDate, options.timeZone);
  currentDate = moment.tz(startDate, options.timeZone);
  availableDateTimes = {};

  // Use this object to pass by reference.
  availableUntilReferences = {value:null};

  // Loop from the start/date time to enddate time.
  while (currentDate.isBefore(endDate)){
    // Check if the user has regular hours set for this date.
    var dayOfTheWeekKey = currentDate.format("d");
    var regularHours = null;
    var lastUnavailable = null;
    var dateOnStart = moment(currentDate);
  
    // Tracks times that the user has set to be available.    
    var scheduledAvailability = this.regularHours[dayOfTheWeekKey];

    // If they requested full day to be returned we can by-pass checking
    // what the regular hours are and instead we'll set the time to 0.
    if (options.includeFullDay) {
      regularHours = {
        'start' : '00:00:00',
        'end' : '23:59:59'
      };
    } else {
      regularHours = scheduledAvailability;
    }

    if (regularHours === undefined) {
      // If no regular hours are set for this day, let's move forward 24 hours.
      currentDate.add(1, "d");
      continue;
    }
    
    // We have regular hours for this day so let's now do some processing.
    var dateKey = currentDate.format("Y-MM-DD");
    
    // Parse our regular hour times into times and start calculating time from the start time up until the end of the day.
    var startTime = moment.tz(regularHours.start, "HH:mm", options.timeZone);
    var endTime = moment.tz(regularHours.end, "HH:mm", options.timeZone);
    var endOfDay = moment(currentDate);
    
    currentDate.hour(startTime.hour()).minute(startTime.minute());
    endOfDay.hour(endTime.hour()).minute(endTime.minute());
        
    var times = [];
    var nextUnavailableAt = {'time' : null};

    while (currentDate.isBefore(endOfDay)) {
      var startFinish = {};

      // If they set to return full times, and this is a time that they want to 
      if (options.includeFullDay) {
        
        // check time in context of the current day.
        var tmpStartDateTime = moment(currentDate);
        var tmpEndDateTime = moment(currentDate);

        if (scheduledAvailability) {
          // query // parse the hour minute from string.
          var tmpStart = moment.tz(scheduledAvailability.start, "HH:mm", options.timeZone);
          var tmpEnd = moment.tz(scheduledAvailability.end, 'HH:mm', options.timeZone);

          tmpStartDateTime.set({'hour': tmpStart.hour(), 'minute' : tmpStart.minute(), 'second': 0, 'millisecond' : 0});
          tmpEndDateTime.set({'hour': tmpEnd.hour(), 'minute' : tmpEnd.minute(), 'second': 0, 'millisecond' : 0});

          if (currentDate.isBetween(tmpStartDateTime, tmpEndDateTime, 'minute', '[)')) {
            startFinish['isScheduledTime'] = true;
          }
        }
      }

      // Test to see that there's no existing appointment at this time.
      var tmpUnavailableAt = this.getUnavailableAt(currentDate);
      if (tmpUnavailableAt.length > 0) {
        if (!lastUnavailable || (lastUnavailable.__availabilityId !== tmpUnavailableAt[0].__availabilityId)) {        
          // If unavilable then next un
          nextUnavailableAt['time'] = tmpUnavailableAt[0]['start'].toISOString();
          nextUnavailableAt = {'time' : null};
          lastUnavailable = tmpUnavailableAt[0];
        }

        availableUntilReferences['value'] = currentDate.toDate();
        if (this.includeUnavailable) {
          startFinish['unavailable'] = tmpUnavailableAt;
        } else {
          currentDate.add(this.interval, 'm');
          continue;
        }
      }

      startFinish['start'] = currentDate.format("HH:mm");
      startFinish['end'] = null;

      if (options['nextUnavailableAt']) { 
        startFinish['nextUnavailableAt'] = nextUnavailableAt;
      }

      if (options['dates']) {
        startFinish['startDate'] = currentDate.toISOString();
      }
      
      // Move the time forward to our end time.
      currentDate.add(this.interval, 'm');

      // Test to see that our end time - 1 second doesn't overlap with any appointment either.
      var tmpCurrentEndTime = moment(currentDate);
      tmpCurrentEndTime.subtract(1, 'second');
      tmpUnavailableAt = this.getUnavailableAt(tmpCurrentEndTime);
      if (tmpUnavailableAt.length > 0) {
        // If the current time is unavilable we need to find the next unavailable time to include.
        if (!lastUnavailable || (lastUnavailable.__availabilityId !== tmpUnavailableAt[0].__availabilityId)) {
          nextUnavailableAt['time'] = tmpUnavailableAt[0]['start'].toISOString();
          nextUnavailableAt = {'time' : null};
          lastUnavailable = tmpUnavailableAt[0];
        }

        

        if (this.includeUnavailable) {
          // If it hasn't yet been set make it an array.
          if (startFinish['unavailable'] === undefined){
            startFinish['unavailable'] = [];
          } 

          startFinish['unavailable'] = startFinish['unavailable'].concat(tmpUnavailableAt);
        } else {
          currentDate.add(this.interval, 'm');
          continue;
        }
      }

      // Remove duplicate unavailable times
      if (startFinish['unavailable'] !== undefined) {
        var dupKeys = {};
        startFinish['unavailable'] = startFinish['unavailable'].filter(function(e){
          // If we found a key in the dup keys object we want this filtered out.
          if (dupKeys[e.__availabilityId] !== undefined) {
            return false;
          }

          dupKeys[e.__availabilityId] = true;
          return true;
        });
      }
      
      startFinish.end = currentDate.format("HH:mm");

      // Add time to our availability.
      if (options['dates']) {
        startFinish.endDate = currentDate.toISOString();
      }

      // Add time to our array of available times
      times.push(startFinish);
    }
    
    nextUnavailableAt['time'] = currentDate.toISOString();


    // If times is not empty let's add it to our array.
    if (times.length > 0) {
      availableDateTimes[dateKey] = times;
    }

    // Move time foward by a day.
    
    // If date is same day as we started then move forward by a day. 
    if (currentDate.isSame(dateOnStart, 'day')) {
      currentDate.add(1, 'd');
    }
  }

  return availableDateTimes;

};

/**
 * Check to see if the user is available at a current date time.
 */
Availability.prototype.isUnavailableAt = function (date) {
  return this.getUnavailableAt(date).length > 0;
};

Availability.prototype.getUnavailableAt = function(date) {
  date = moment(date);
  
  dateKey = date.format('Y-MM-DD');
  hourKey = date.format('H');
  
  if (this.unavailable[dateKey] === undefined) 
    return [];
  
  if (this.unavailable[dateKey][hourKey] === undefined)
    return [];
  
  var unavailable  = [];

  // Loop through the unavailable times and determine if the selected time is unavailable.
  for (var x in this.unavailable[dateKey][hourKey]) {
    // Convinience variable.
    var timeNotAvailable = this.unavailable[dateKey][hourKey][x];
    
    // if the start time falls between the start and end time then they are unavailable
    if (date.isBetween(timeNotAvailable['start'], timeNotAvailable['end'], 'seconds','[)')) {
      unavailable.push(timeNotAvailable);
    }
  }

  // Nothings matched so false.
  return unavailable;
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

Availability.prototype.setIncludeUnavailable = function(includeUnavailable) {
  this.includeUnavailable = !!includeUnavailable;
  return this;
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
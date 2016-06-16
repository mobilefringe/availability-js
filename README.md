#Usage
```
require 'availability'
av = new Availability();
av.setRegularHours({
  "Monday": {
    "start": "09:00:00",
    "end": "17:00:00"
  },
  "Tuesday": {
    "start": "12:00:00",
    "end": "17:00:00"
  },
  "Wednesday": {
    "start": "17:00:00",
    "end": "22:00:00"
  }
});

av.addUnavailable('2016-06-21 13:30', '2016-06-21 15:30');
av.addUnavailable('2016-06-20 12:15', '2016-06-20 14:15');
```

Will return json object of available times removing unavailable blocks.
```
{
  "2016-06-20": [
    {
      "start": "09:00",
      "end": "10:00"
    },
    {
      "start": "10:00",
      "end": "11:00"
    },
    {
      "start": "11:00",
      "end": "12:00"
    },
    {
      "start": "15:00",
      "end": "16:00"
    },
    {
      "start": "16:00",
      "end": "17:00"
    }
  ],
  "2016-06-21": [
    {
      "start": "12:00",
      "end": "13:00"
    },
    {
      "start": "16:00",
      "end": "17:00"
    }
  ],
  "2016-06-22": [
    {
      "start": "17:00",
      "end": "18:00"
    },
    {
      "start": "18:00",
      "end": "19:00"
    },
    {
      "start": "19:00",
      "end": "20:00"
    },
    {
      "start": "20:00",
      "end": "21:00"
    },
    {
      "start": "21:00",
      "end": "22:00"
    }
  ]
}
```

## Advanced Features
### Set interval for availability blocks.
```
av.setInterval([minutes = 60])
```


## About

# SmartParkRadar

A map app for driving to a place in the Netherlands: it finds where to park near the destination, drives the user there and walks them the rest.

## Language

### Parking

**Destination**:
The place the user wants to end up at, on foot, after parking.
_Avoid_: target, goal

**Parking spot**:
One real place to leave the car near a destination (a street, lot, garage or bay) with its price and rules.
_Avoid_: parking option, facility

**Zone**:
An area where the national parking registry (RDW) makes kerbside parking paid or permit-only during set hours.
_Avoid_: area, region

**Arrival estimate**:
When the car is expected at the destination, from a rough drive time before any route exists; zone hours are checked against it.
_Avoid_: ETA

**Max walk**:
The farthest the user is willing to walk from the parking spot to the destination, picked from a few fixed distances.
_Avoid_: walk limit, walking radius

**Parking scan**:
The parking spots around a destination, the best one for the max walk, and a hint when free parking lies just beyond it.
_Avoid_: parking result, parking search

### Journey

**Journey**:
Everything from picking a destination to arriving there: first planning (parking scan and routes), then navigating the trip.
_Avoid_: trip (that is only the navigating part), session

**Route**:
One way to drive to the chosen parking spot (from the parked car, or else from the user's location); the planner offers up to three.
_Avoid_: path, itinerary

**Route preference**:
Which kind of route comes selected first: fastest, fewest cameras or steadiest. Steadiest unless the user changes it.
_Avoid_: route mode, routing profile

**Steadiest route**:
The route that stays longest at one speed limit, with the fewest turns.
_Avoid_: calmest, smoothest, most constant

**Trip**:
The navigating part of a journey, made of legs, with spoken guidance.
_Avoid_: ride, navigation session

**Leg**:
One part of a trip: the walk to the parked car (when it is elsewhere), the drive to the parking spot, or the walk to the destination.
_Avoid_: stage, segment

**Parked car**:
Where the user's car was last left, remembered by the app until they drive off in it or tell it to forget.
_Avoid_: car location, saved spot (a parking spot is a different thing)

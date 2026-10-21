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
One way to drive from the user's location to the chosen parking spot; the planner offers the fastest and a few alternatives.
_Avoid_: path, itinerary

**Trip**:
The navigating part of a journey: the drive along the chosen route to the parking spot, then the walking leg, with spoken guidance.
_Avoid_: ride, navigation session

**Walking leg**:
The walk from the parking spot to the destination at the end of a trip.
_Avoid_: last mile

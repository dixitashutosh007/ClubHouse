/**
 * Wording for RideShare notifications. Everyone on a ride is a neighbour,
 * so messages speak of fellow residents sharing a journey, never of
 * drivers and passengers.
 */

export interface NotificationText {
  title: string;
  body: string;
}

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || 'A neighbour';

export const rideMessages = {
  /** To the offerer: a neighbour asked to join */
  requested(seekerFullName: string, seats: number, destination: string): NotificationText {
    const who = firstName(seekerFullName);
    return {
      title: 'A neighbour would like to ride along',
      body:
        seats > 1
          ? `${who}, a fellow resident, is requesting to tag along with you (${seats} seats) to ${destination}.`
          : `${who}, a fellow resident, is requesting to tag along with you to ${destination}.`,
    };
  },

  /** To the seeker: the offerer accepted */
  accepted(offererFullName: string, destination: string): NotificationText {
    return {
      title: 'Your ride is confirmed 🙏',
      body: `${firstName(offererFullName)}, a fellow resident, has graciously accepted your request to accompany them to ${destination}. You can now call or WhatsApp them.`,
    };
  },

  /** To the seeker: the offerer could not take them */
  declined(destination: string, wasAccepted: boolean): NotificationText {
    return wasAccepted
      ? {
          title: 'Change of plans for your ride',
          body: `Your fellow resident can no longer take you along to ${destination}. Please look for another ride.`,
        }
      : {
          title: 'Your ride request could not be accommodated',
          body: `Your fellow resident could not make room this time for the trip to ${destination}. Other neighbours may be heading the same way.`,
        };
  },

  /** To the offerer: a confirmed co-rider withdrew */
  seekerCancelled(seekerFullName: string, seats: number, destination: string): NotificationText {
    return {
      title: 'A co-rider can no longer join',
      body: `${firstName(seekerFullName)} can no longer join your ride to ${destination}. ${seats} seat${seats > 1 ? 's are' : ' is'} open again.`,
    };
  },

  /** To accepted riders: the offerer has set off */
  started(offererFullName: string, destination: string): NotificationText {
    return {
      title: 'Your ride is on its way',
      body: `${firstName(offererFullName)} has started the ride to ${destination}. Please be at the pick-up point.`,
    };
  },

  /** To accepted riders after the ride */
  completed(offererFullName: string, destination: string): NotificationText {
    return {
      title: 'Hope you had a good ride',
      body: `Your ride with ${firstName(offererFullName)} to ${destination} is complete. A quick rating helps your neighbours.`,
    };
  },

  /** To the seekers on a ride the offerer cancelled */
  rideCancelled(offererFullName: string, destination: string, dayLabel: string): NotificationText {
    return {
      title: 'Ride cancelled',
      body: `${firstName(offererFullName)} had to cancel the ride to ${destination} (${dayLabel}). Sorry for the change; other neighbours may be heading the same way.`,
    };
  },
};

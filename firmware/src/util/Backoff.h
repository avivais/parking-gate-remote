#ifndef BACKOFF_H
#define BACKOFF_H

#include <Arduino.h>

/**
 * Exponential backoff utility for retry logic.
 * Doubles delay on each increment, capped at maximum.
 */
class Backoff {
public:
    Backoff(unsigned long baseMs, unsigned long maxMs);

    /**
     * Get the next delay value (current delay before increment).
     */
    unsigned long getNextDelay();

    /**
     * Reset backoff to base delay.
     */
    void reset();

    /**
     * Increment backoff (double the delay, cap at max).
     */
    void increment();

private:
    unsigned long baseMs;
    unsigned long maxMs;
    unsigned long currentMs;
};

#endif // BACKOFF_H


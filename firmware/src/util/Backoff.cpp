#include "Backoff.h"

Backoff::Backoff(unsigned long baseMs, unsigned long maxMs)
    : baseMs(baseMs), maxMs(maxMs), currentMs(baseMs) {
}

unsigned long Backoff::getNextDelay() {
    return currentMs;
}

void Backoff::reset() {
    currentMs = baseMs;
}

void Backoff::increment() {
    unsigned long next = currentMs * 2;
    if (next > maxMs) {
        currentMs = maxMs;
    } else {
        currentMs = next;
    }
}


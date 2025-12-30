// Pre-include header for TinyGSM
// This MUST be included before ANY TinyGSM headers
// It defines the modem model that TinyGSM requires

#ifndef TINYGSM_PRE_H
#define TINYGSM_PRE_H

// A7670 is not directly supported in standard TinyGSM
// It's part of SIM76XX family, so use SIM7600 driver
// If TINY_GSM_MODEM_A7670 is needed for LilyGo-specific code, define both
#define TINY_GSM_MODEM_SIM7600  // Use SIM7600 driver (A7670 is compatible)
#define TINY_GSM_MODEM_A7670    // Keep for LilyGo utilities.h compatibility

// Define RX buffer size
#ifndef TINY_GSM_RX_BUFFER
#define TINY_GSM_RX_BUFFER 1024
#endif

#endif // TINYGSM_PRE_H


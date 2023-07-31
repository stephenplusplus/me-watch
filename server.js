const notifier = require("node-notifier")
const sdk = require("api")("@tallal-test/v1.0#e9ugg1clijv97p7")

const COLLECTION_SYMBOL = process.env.ME_COLLECTION_SYMBOL || "omb" // default OMB :)
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000 // 3 mins
const MAX_API_RETRIES = 3

run()

const RUN_STATE = {
  errorCount: 0,
  timeoutMs: DEFAULT_TIMEOUT_MS,
}

async function run() {
  try {
    await checkForActivities()
    resetRunState()
  } catch (e) {
    RUN_STATE.errorCount++
    RUN_STATE.timeoutMs *= 1.5

    notify({
      title: `${COLLECTION_SYMBOL} Error`,
      message: e.message,
    })
  }

  if (RUN_STATE.errorCount === MAX_API_RETRIES) {
    notify({ title: `${COLLECTION_SYMBOL} Watcher Shutting Down` })
    setTimeout(() => process.exit(), 100)
    return
  }

  setTimeout(run, RUN_STATE.timeoutMs)
}

let MOST_RECENT_PROCESSED_DATE = new Date()
async function checkForActivities() {
  log("Sending API request...")

  // (see an API response example at the end of the file)
  const { data: { activities } } = await sdk.getActivities({
    collectionSymbol: COLLECTION_SYMBOL,
    limit: "20"
  })

  activities
    .filter(activity => new Date(activity.createdAt) > MOST_RECENT_PROCESSED_DATE)
    .forEach(activity => {
      const notification = {
        message: `Price: ${satsToBTC(activity.listedPrice)} BTC`,
        open: `https://magiceden.io/ordinals/item-details/${activity.tokenId}`,
      }
      if (activity.kind === "list" || activity.kind === "buying_broadcasted") {
        notify({
          ...notification,
          title: `New ${COLLECTION_SYMBOL} ${activity.kind === "list" ? "Listing" : "Sale"}`,
          contentImage: `https://ord-mirror.magiceden.dev/content/${activity.tokenId}`,
        })
      } else {
        log({
          ...notification,
          kind: activity.kind
        })
      }
    })

  MOST_RECENT_PROCESSED_DATE = new Date(activities[0].createdAt)
}

function log() {
  const now = (new Date()).toLocaleString()
  console.log(now, ...arguments)
}

function notify(obj) {
  notifier.notify({
    sticky: true,
    ...obj
  })

  for (const key in obj) {
    const val = obj[key]
    if (typeof val === "string") {
      log(val)
    }
  }
}

function resetRunState() {
  RUN_STATE.errorCount = 0
  RUN_STATE.timeoutMs = DEFAULT_TIMEOUT_MS
}

function satsToBTC(sats) {
  return sats * 0.00000001
}

// MAGICEDEN API RESPONSE FORMAT:
// {
//   total: '15843',
//   activities:
//   {
//     kind: 'list',
//     tokenId: '894b6f56ed1acc9aff31b1f9b13d6686a21e8e7c398942a0c21afe5276d31c6ei0',
//     chain: 'btc',
//     collectionSymbol: 'omb',
//     collection: [Object],
//     token: [Object],
//     createdAt: 'Wed, 19 Jul 2023 14:22:45 GMT',
//     tokenInscriptionNumber: 11210016,
//     listedPrice: 36900000,
//     newOwner: 'bc1plnle8k2cs33shmwv8h55d75ss99z9lu044st7p4dmhm5r3wceejq9p6mwl',
//     txValue: 0,
//     sellerPaymentReceiverAddress: '3PWLvRCPijgyuRWSVUViw755StMbUNikf6',
//     buyerPaymentAddress: null
//   },
//   // ....
// }
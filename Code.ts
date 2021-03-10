import utils from "./utils";
import oauth_helpers from "./oauth_helper";

// Run this function once to grant script access and add trigger automatically.
// Automatically adds new subscription videos from youtube to watch later list (if you have email notifications for those turned on)
/* eslint-disable @typescript-eslint/no-unused-vars */
// noinspection JSUnusedGlobalSymbols
function createNewTrigger() {
  ScriptApp.newTrigger("processNewRssItems")
    .timeBased()
    .everyMinutes(30) // Runs script every n min. You can change this to days, hours, min, etc. Just google how to set the triggers by using a script.
    .create();
}

function addAccessToken() {
  let accessToken = "17223d1be0cd57c08ae85914ec714794970786da";
  let expiresIn = 86400;
  let refreshToken = "4a0be0425895e6de36ecfa5adb87639c8ba8752f";
  let clientId = "999999586";
  let clientSecret = "LjJjQPBURKF9X27Y3r4mNEGfwgraDLJG";

  let now = Date.now();
  let expiresAt = new Date(now + expiresIn * 1000);

  let properties = PropertiesService.getUserProperties();

  properties.setProperty("inoreaderAccessToken", accessToken);
  properties.setProperty("inoreaderRefreshToken", refreshToken);
  properties.setProperty("inoreaderExpiresAt", expiresAt.toISOString());
  properties.setProperty("inoreaderClientId", clientId);
  properties.setProperty("inoreaderClientSecret", clientSecret);
}

function getUnreadFeedItems(inoreaderStreamId) {
  let properties = PropertiesService.getUserProperties();
  let accessToken = properties.getProperty("inoreaderAccessToken");
  let appId = properties.getProperty("inoreaderClientId");
  let options = {
    headers: { Authorization: "Bearer " + accessToken },
    AppId: appId,
    muteHttpExceptions: true
  };

  let queryParams = "xt=user/-/state/com.google/read&n=50";

  let url = `https://www.inoreader.com/reader/api/0/stream/contents/${inoreaderStreamId}?${queryParams}`;

  console.log("Sending request to url = " + url + " with options " + JSON.stringify(options));

  let response = UrlFetchApp.fetch(url, options);
  let responseCode = response.getResponseCode();
  let responseContent = response.getContentText();

  if (responseCode >= 300) {
    console.log("Got error response when fetching unread articles, refreshing token");
    oauth_helpers.refresh_token();
    var newAccessToken = properties.getProperty("inoreaderAccessToken");
    delete options.muteHttpExceptions;
    options.headers.Authorization = "Bearer" + newAccessToken;
    response = UrlFetchApp.fetch(url, options);
    responseCode = response.getResponseCode();
    responseContent = response.getContentText();
  }

  if (responseCode === 400) {
    throw "400 Mandatory paramters missing for request - " + responseContent
  }

  if (responseCode === 401) {
    throw "401 End-user not authorized for request - " + responseContent
  }

  if (response.getResponseCode() === 403) {
    throw "403 You are not sending the correct AppID and/or AppSecret for request - " + responseContent
  }

  Logger.log("Inoreader response code = " + response.getResponseCode() + " body = " + response.getContentText());

  let feedItems = JSON.parse(response.getContentText())["items"];

  let result = undefined;
  if (feedItems !== undefined) {
    result = [];
    for (var i = 0; i < feedItems.length; i++) {
      var feed = feedItems[i];
      var videoUrl = feed["canonical"][0]["href"];
      var videoUrlSplit = videoUrl.split("watch?v=");
      var videoId = videoUrlSplit[videoUrlSplit.length - 1];
      var timestamp = parseInt(feed["timestampUsec"], 10);
      var feedIdSplit = feed["id"].split("/");
      var feedId = feedIdSplit[feedIdSplit.length - 1];
      result.push({ videoId: videoId, timestamp: timestamp, feedId: feedId });
    }
  }

  return result;
}
/* eslint-enable */

//This is the main function, run this
// noinspection JSUnusedGlobalSymbols
function processNewRssItems() {
  // ------------------------------------------------------------------------------------------------------------------------------
  // Set some variables
  // ------------------------------------------------------------------------------------------------------------------------------
  // Set playlist ID that you want to add the videos to.
  // The ID for your Watch Later playlist is just 'WL'.
  // The playlist ID is the random string of character in the url when you open the playlist.
  const watchLaterPL = "PLplsWzmJ6PmNotZhyVV5LBrbXGPsnPBgE";
  const longVideosPL = "PLplsWzmJ6PmMOWpNawezm6W544BeGWJ6H";
  const busPL = "PLplsWzmJ6PmOz2mG3twNNfAOf6fLVUt5B";
  const inoreaderStreamId = "user%2F-%2Flabel%2FYouTube%20Subscriptions";

  const playlistIds = [watchLaterPL, longVideosPL, busPL];

  // Set the minimum duration, in seconds, for videos to be included in PL (comment out if not needed)
  const minDurationSeconds = 20;

  // Set the maximum duration, in seconds, for videos to be included in PL. Anything longer than this
  // will be included in the 'longVideosPL' playlist. If you want all videos to be included in the
  // 'watchLaterPL' comment this out.
  const longVideosMinDurationSeconds = 20 * 60;

  // Make an object we can pass around as our "settings" rather then moving all the variables all the time
  const preferences = {
    minDurationSeconds: minDurationSeconds,
    longVideosMinDurationSeconds: longVideosMinDurationSeconds,
    playlistIdentifierToIdMap: {
      wl: watchLaterPL,
      long: longVideosPL,
      bus: busPL
    },
  };

  // Set Google Sheets IDs for logging
  // "Log" sheet is used for informational logs
  // "Error" sheet is used for errors
  const logSheetId = "1HxCr_LnMKvsNsLZq86aMiptTRDyDZ-E4R0KyiSPBBmY";

  // Set regex to find video ID in email subscriptions - you shouldn't need to change this.
  // Prior to 20160713: regex for video IDs was: RegExp(".*/watch%3Fv%3D([^%]+)%.*", "gi");
  const regexp = new RegExp(".*v%3D([^%]+)%.*", "gi");

  // For debugging
  Logger.log("Variables...");
  Logger.log("Watch later PL: " + watchLaterPL);
  Logger.log("Long videos PL: " + longVideosPL);
  Logger.log("Bus PL: " + busPL);
  Logger.log("Min Duration: " + minDurationSeconds);
  Logger.log("Max Duration: " + longVideosMinDurationSeconds);
  Logger.log("Log Sheet: " + logSheetId);

  // ------------------------------------------------------------------------------------------------------------------------------
  // Get unread inoreader feed items
  // ------------------------------------------------------------------------------------------------------------------------------
  let newVideos = getUnreadFeedItems(inoreaderStreamId);
  if (newVideos === undefined) {
    Logger.log("New videos list is empty, check response from inoreader")
    return
  }

  // Exit if no emails found (return works since we're in top level of function) - avoids making any YT API calls.
  if (newVideos.length > 0) {
    const existingPlVideosMap = utils.getExistingPlaylistVideos(playlistIds);

    // For debugging
    Logger.log("Watch later PL videos: " + existingPlVideosMap[watchLaterPL]);
    Logger.log("Long videos PL videos: " + existingPlVideosMap[longVideosPL]);
    Logger.log("Bus PL videos: " + existingPlVideosMap[busPL]);

    const logSheet = SpreadsheetApp.openById(logSheetId).getSheetByName("Log");
    const errorSheet = SpreadsheetApp.openById(logSheetId).getSheetByName("Error");

    // ------------------------------------------------------------------------------------------------------------------------------
    // Process YouTube emails and add videos to playlists
    // ------------------------------------------------------------------------------------------------------------------------------
    // For each email in results of email search, process any video ID
    // Get date var for logging
    const currentTime = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd HH:mm:ss"); // change the timezone if you need to
    let handledFeedIds = [];

    try {
      for (let i = 0; i < newVideos.length; i++) {
        // for each video in the message
        const videoId = newVideos[i]["videoId"];
        const videoTimestamp = newVideos[i]["timestamp"];
        const feedId = newVideos[i]["feedId"];

        const details = {
          videoId: videoId,
          kind: "youtube#video",
        };

        Logger.log("New video ID: " + videoId); // For debugging

        // get video info
        const videoResponse = YouTube.Videos.list("snippet, contentDetails", {
          id: videoId,
          maxResults: 1,
        });

        if (videoResponse.items.length > 0) {
          const theVideo = videoResponse.items[0];

          // Set video title
          const videoTitle = theVideo.snippet.title;

          // Calc video duration
          const videoDurationSeconds = utils.calcVideoDurationInSeconds(theVideo);

          if (videoDurationSeconds > 0) {
            Logger.log("Video length: " + videoDurationSeconds); // For debugging
          } else {
            if (videoDurationSeconds === 0) {
              console.log(`Video ${theVideo.snippet.title} is currently streaming, cannot handle`);
            } else {
              utils.writeErrorToSheet(
                `Could not parse duration: ${theVideo.contentDetails.duration} for video: ${theVideo.snippet.title}`,
                errorSheet,
                currentTime
              );
            }
          }

          if (videoDurationSeconds > 0) {
            // Pick PL to add video to
            const [vidStatus, plToUse] = utils.pickPlForVideo(videoTitle, videoDurationSeconds, preferences);

            // Add the video to the playlist
            const resource = {
              snippet: {
                playlistId: plToUse,
                resourceId: details,
              },
            };

            try {
              YouTube.PlaylistItems.insert(resource, "snippet");
              // Log added videos to sheet
              const lastRow = logSheet.getLastRow();
              const cell = logSheet.getRange("A1");

              cell.offset(lastRow, 0).setValue(currentTime); // Email processed time
              cell.offset(lastRow, 1).setValue(videoTitle); // Video Title
              cell.offset(lastRow, 3).setValue(videoId); // Vid ID
              cell.offset(lastRow, 4).setValue(vidStatus); // Added to PL / Already in PL / etc
              cell.offset(lastRow, 5).setValue(videoDurationSeconds); // Vid duration
              cell.offset(lastRow, 6).setValue(resource); // resource details

              // Push to list of handled video articles
              handledFeedIds.push(feedId);
            } catch (e) {
              if (e.message.indexOf("Video already in playlist") === -1) {
                Logger.log(`Exception while inserting video ${videoTitle} to playlist ${plToUse}`);
                utils.writeExceptionToSheet(e, errorSheet, currentTime);
                throw e;
              } else {
                Logger.log("Tried to add video " + videoTitle + " to PL " + plToUse + " but it already exists");
              }
            }
          }
        }
      }

      if (handledFeedIds.length > 0) {
        let properties = PropertiesService.getUserProperties();

        let accessToken = properties.getProperty("inoreaderAccessToken");

        let options = {
          headers: { Authorization: "Bearer " + accessToken },
        };

        for (let i = 0; i < handledFeedIds.length; i++) {
          handledFeedIds[i] = `i=${handledFeedIds[i]}`;
        }

        let handledFeedIdsMultipartParam = handledFeedIds.join("&");

        let queryParams = `a=user/-/state/com.google/read&${handledFeedIdsMultipartParam}`;
        let url = `https://www.inoreader.com/reader/api/0/edit-tag?${queryParams}`;
        let response = UrlFetchApp.fetch(url, options);
        console.log(
          `Marked handled feed ids as read, got response ${response.getResponseCode()}: ${response.getContentText()}`
        );
      }
    } catch (e) {
      // This logs any errors in a Drive sheet. Set sheet ID at top of function.
      utils.writeExceptionToSheet(e, errorSheet, currentTime);
      throw e;
    }
  } else {
    Logger.log("Exiting - no video notification emails found");
  }
}

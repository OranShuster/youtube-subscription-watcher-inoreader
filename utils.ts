import Sheet = GoogleAppsScript.Spreadsheet.Sheet;

export default class utils {
  static getPlVideosList(targetPL): Array<string> {
    const ret = [];
    let nextPageToken = "";

    while (nextPageToken != null) {
      const playlistResponse = YouTube.PlaylistItems.list("snippet", {
        playlistId: targetPL,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      for (let itemIndex = 0; itemIndex < playlistResponse.items.length; itemIndex++) {
        const playlistItem = playlistResponse.items[itemIndex];
        ret.push(playlistItem.snippet.resourceId.videoId);
      }

      nextPageToken = playlistResponse.nextPageToken;
    }

    return ret;
  }

  static getExistingPlaylistVideos(playlists: Array<string>) {
    // ------------------------------------------------------------------------------------------------------------------------------
    // Create list of video IDs already in destination playlists to check for duplicates when adding new videos
    // - this used to come before the email search but YT made even tighter API limits (20000/day) in May 2019
    //   so moved here since we don't need to check for duplicates unless we find a new video notification.
    // - longer playlists use up more API calls, e.g. if the 'long videos' playlist builds up and has lots of
    //   videos in it over time then it will use lots of the API quota so clear it out into an archive or
    //   separate list every so often
    // ------------------------------------------------------------------------------------------------------------------------------
    const existingVideosMap = {};

    for (const id of playlists) {
      existingVideosMap[id] = utils.getPlVideosList(id);
    }

    return existingVideosMap;
  }

  static pickPlForVideo(videoTitle, videoDurationSeconds, preferences): Array<string> {
    const longVideosMinDurationSeconds = preferences["longVideosMinDurationSeconds"];
    const playlistIdentifierToIdMap = preferences["playlistIdentifierToIdMap"];

    //Default PL is watch later
    let plToUse = playlistIdentifierToIdMap["wl"];
    let vidStatus = "Added to watch later PL";

    // Check if video too long
    if (typeof longVideosMinDurationSeconds !== "undefined" && videoDurationSeconds > longVideosMinDurationSeconds) {
      vidStatus = `Adding video ${videoTitle} to long PL since video duration is ${videoDurationSeconds}`;
      plToUse = playlistIdentifierToIdMap["long"];
    }

    //Check if video is ASMR
    const asmrSearchTerm = "asmr";

    if (videoTitle.toLowerCase().indexOf(asmrSearchTerm) !== -1) {
      vidStatus = `Adding video ${videoTitle} to bus PL since video title contains ${asmrSearchTerm}`;
      plToUse = playlistIdentifierToIdMap["bus"];
    }
    return [vidStatus, plToUse];
  }

  static writeErrorToSheet(message: string, errorSheet: Sheet, currentTime: string) {
    const lastRow = errorSheet.getLastRow();
    const cell = errorSheet.getRange("A1");
    cell.offset(lastRow, 0).setValue(currentTime);
    cell.offset(lastRow, 1).setValue(message);
  }

  static writeExceptionToSheet(e, errorSheet: Sheet, currentTime: string) {
    const lastRow = errorSheet.getLastRow();
    const cell = errorSheet.getRange("A1");
    cell.offset(lastRow, 0).setValue(currentTime);
    cell.offset(lastRow, 1).setValue(e.message);
    cell.offset(lastRow, 2).setValue(e.fileName);
    cell.offset(lastRow, 3).setValue(e.lineNumber);
  }

  static calcVideoDurationInSeconds(theVideo: GoogleAppsScript.YouTube.Schema.Video) {
    //Set regex to calculate video length in seconds
    const durationRegExp = new RegExp(
      "P(?:([0-9]{0,3})D)?T(?:([0-9]{0,2})H)?(?:([0-9]{0,2})M)?(?:([0-9]{0,2})S)?",
      "ig"
    );
    const lifeStreamDuration = "P0D";
    const duration = theVideo.contentDetails.duration;

    let videoDurationSeconds = -1;

    if (duration === lifeStreamDuration) {
      console.log(`Video ${theVideo.snippet.title} is live streaming now, cannot determine duration`);
      videoDurationSeconds = 0;
    } else {
      const durationResult = durationRegExp.exec(duration);

      if (durationResult != null) {
        if (durationResult[4]) {
          videoDurationSeconds += parseInt(durationResult[4]);
        }
        if (durationResult[3]) {
          videoDurationSeconds += parseInt(durationResult[3]) * 60;
        }
        if (durationResult[2]) {
          videoDurationSeconds += parseInt(durationResult[2]) * 60 * 60;
        }
        if (durationResult[1]) {
          videoDurationSeconds += parseInt(durationResult[1]) * 24 * 60 * 60;
        }
      } else {
        console.error(`Could not read duration of video ${theVideo.snippet.title}: ${duration}`);
      }
    }

    return videoDurationSeconds;
  }
}

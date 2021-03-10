youtube-subscription-watcher - Add videos to youtube playlists from subscription notification emails
This code is now deprecated since YouTube discontinued email subscription notifications
I Changed my script to work with inoreader since exporting subscriptions to RSS is supported by YT and can be found here
This is a GAS (Google Apps Script) script that will automatically add new videos from your subscribed channels to a specified playlist which you own (using the playlist ID).

You need to have subscribed to the channel and turn on email notifications (using the 'bell' icon).

The script have logs going out to GAS stackdriver. Additionally, certain events are written to a Google sheet (specified in the script)

Added videos are written along with the playlist chosen
Errors and exception are written to the same file under a different sheet.
This script can be extended to fit your needs. In this script there are examples for the following criteria:

Change the playlist based on video duration 1.1. Ignore very short videos. 1.2. Add long videos to a different playlist.
Add videos with specific words in their title to a different playlist
This is heavily based on other works https://www.reddit.com/r/youtube/comments/2x3ew4/automatically_add_ew_subscription_videos_to_the/ https://www.reddit.com/r/youtube/comments/3ukn4w/automatically_adding_youtube_videos_to_watch/ https://www.mc-guinness.co.uk/blog/20160218/youtube-automatically-add-new-videos-to-playlist/

How to use
This project is using clasp for deployment and local development
Once the project is pushed and a new GAS script is created, you can manually run the "add trigger" function in the main file to create a new periodic trigger.
When manually running the "add trigger" or the main function for the first time, google might ask you to give permissions to the project
Or, the code can be manually copied to a new GAS project and permissions can be set manually
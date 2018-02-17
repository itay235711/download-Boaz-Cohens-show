# download-Boaz-Cohens-show
Simple node project to automate download of Boaz Cohen's show on 88fm from YouTube as a directory of mp3 files  
It also support uploading the directory to Google drive for backup and sharing


To run this project, clone it and run 'npm install', then run 'node src\index.js --mode=[chosen mode]'  
There are currently three modes available:  
* single_title: Download the a single song by a title
* input_file: Download all the titles within an input file (each title in a new line)
* yedidyas_shazam: This mode follows the next steps:
  - Finds out which new songs Yedidya emailed to himself from Shazam (via cloud HQ labels sharing Gmail extension)
  - Tries to download each song, marking songs successfully downloaded as 'read' and unsuccessfully songs as 'important' (leaving them unread for next try)
  - Uploads the entire folder to the Google Drive of the user 'SongsSharer2' (created for this project)


Notes:
* This project will not run without the oath secret files of my Google accounts, to get them please contact me personally
* Yedidya is a friend of mine who likes to use Shazam's feature of emailing to himself songs he liked during the day
* I was working on a mode that would use PhantomJS to browse to the site of 88fm radio station, open the playlist of specific show, parse the HTML to retrieve the song titles from the playlist and download them. Unfortunately, Boaz Cohen announced on leaving 88fm a short time after I started this project, so I couldn't see the point...

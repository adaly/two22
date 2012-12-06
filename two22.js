var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;

// Stores all the playlists we find
var stored_playlists = new Object();
// Stores the tracks and their scores
var track_scores = new Object();

exports.init = init;

function init() 
{
	var track = player.track;
	var uri = document.getElementById('uri');
	uri.value = track.uri;
	searchButtonClicked();
}

function searchButtonClicked() 
{
	var uri = document.getElementById('uri');
	if (uri.value != '')
		clearHTML();
		searchTrack(uri.value);
		scoreTracks();
}

//TODO: Ensure that there are no repeated playlists after merging track, artist, album results
function searchTrack(uri) 
{
	var t = models.Track.fromURI(uri,function(track){
		//Search by name
		console.log('Search by track name:', track.name);
		searchPlaylists(track.name,uri);

		track.data.artists.forEach(function(artist) 
		{
			//Search by artist
			console.log('Search by artist:', artist.name);
			if (artist.name != track.name)
				searchPlaylists(artist.name, uri);
		});

		//Search by album
		console.log('Search by album:',track.data.album.name);
		if (track.data.album.name != track.name)
			searchPlaylists(track.data.album.name, uri);

		addTrackHTML(track);
	});
}

/*
 * Searches for all playlists by a given keyword containing the specified track, then
 * adds them to the HTML and returns a list of their URIs
 */
//TODO: Modify to take a list of URIs and check if ANY of them are in the playlist
//TODO: Expand search to other playlists created by the same user (can we search by user? I can parse the user ID from the playlist ID)
function searchPlaylists(keyword, trackURI) 
{
	var search = new models.Search(keyword);
	search.localResults = models.LOCALSEARCHRESULTS.IGNORE

	search.searchAlbums = false;
	search.searchArtists = false;
	search.searchTracks = false;
	search.pageSize = 50;

	search.observe(models.EVENT.CHANGE, function() {
  		search.playlists.forEach(function(playlist) {
  			if (playlist.indexOf(trackURI) >= 0) {
   				console.log(playlist.data.getTrackAddTime(0));
   				if (stored_playlists[playlist.uri] == null) 
   				{
   					addPlaylistHTML(playlist);
   					analyzePlaylist(playlist);
   					stored_playlists[playlist.uri] = true;
   				}
   			}
  		});
	});
	search.appendNext();
}

/*
 * Creates an href for a given playlist and inserts it into the 'results' list HTML
 */
function addPlaylistHTML(playlist) 
{
	resultsList = document.getElementById('results');

	var link = document.createElement('li');
   	var a = document.createElement('a');
   	a.href = playlist.uri;
   	link.appendChild(a);
   	a.innerHTML = playlist.name+" - "+playlist.data.subscriberCount+" subscribers";
   	resultsList.appendChild(link);
}

function addTrackHTML(track) 
{
	info = document.getElementById('trackInfo');

	var link = document.createElement('li');
   	var a = document.createElement('a');
   	a.href = track.uri;
   	link.appendChild(a);
   	a.innerHTML = track.name;
   	info.appendChild(link);
}

function clearHTML() {
	resultsList = document.getElementById('results');
	info = document.getElementById('trackInfo');

	resultsList.innerHTML = '';
	info.innerHTML = '';
	console.log(resultsList);
	console.log(info);
}

// Object to store track
function TrackScore(trackName, score) 
{
	this.getName = trackName;
	this.getScore = score;
	this.addScore = function() { this.getScore++; }
}

// goes through each playlist and adds the tracks 
function analyzePlaylist(playlist)
{
	console.log("Analyzing:",playlist.name);
	label = document.getElementById('scores');

	var length = playlist.length;	
	for (var i = 0; i < length; i++)
	{
		var track = playlist.get(i);
		if(track.uri.substring(0, 12) == "spotify:user")
			console.log("WEIRD PLAYLIST GETS IN", track.uri);
		if(track_scores[track.uri] == null)
		{
			track_scores[track.uri] = new TrackScore(track.name, 1);
		}
		else
		{
			track_scores[track.uri].addScore(); 
		}
	}
	console.log("Done analyzing");
}

// goes through the stored songs and scores them
function scoreTracks()
{
	label = document.getElementById('scores');

	for (var key in track_scores)
	{
		if(track_scores.hasOwnProperty(key))
		{
			console.log("Key", key);
			var trackscore = track_scores[key];
			if(trackscore != null)
			{
				var link = document.createElement('li');
			   	var a = document.createElement('a');
			   	a.href = key;
			   	link.appendChild(a);
			   	a.innerHTML = trackscore.getName + " " + trackscore.getScore;
			   	label.appendChild(link);
			}
		}	
	}
}
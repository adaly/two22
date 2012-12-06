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
	
	var x1 = new Array("A","B","C","D");
	var x2 = new Array("D","F","E","C");
	var x3 = new Array("B","E","F","A");
	var x4 = new Array("B","C","D","E");
	var x5 = new Array("C","F","A","B");
	var x6 = new Array("A","E","F","D");
	var lists = new Array(x1,x2,x3,x4,x5,x6);
	
	console.log(markovStep("B",lists,4));
}

function markovStep(item,lists,type)
{
	// MC1 method from Dwork et. al.
	if (type == 1) {
		var nlists = 0; var totalrank = 0;
		var songs = new Array();
		lists.forEach(function(list) {
			if (list.indexOf(item) >= 0) {
				nlists += 1; 
				totalrank += (list.indexOf(item)+1);
				for (var i=0; i<list.indexOf(item); i++)
					if (songs.indexOf(list[i]) == -1)
						songs.push(list[i]);
			}
		});
		//console.log(songs);
		// Stay on current page with probability proportional to avg. rank
		if (songs.length == 0 || Math.random()<=1/(totalrank/nlists))
			return item;
		return songs[Math.floor(Math.random()*songs.length)];
	}
	// MC2 and MC3 method
	if (type == 2 || type == 3) {
		var pluslists = new Array();
		lists.forEach(function(list) {
			if (list.indexOf(item) >= 0)
				pluslists.push(list);
		});
		if (pluslists.length == 0)
			return item;
		var chosen = pluslists[Math.floor(Math.random()*pluslists.length)];
		//console.log(chosen);
		if (type == 2)
			return chosen[Math.floor(Math.random()*(chosen.indexOf(item)+1))];
		if (type == 3) {
			randsong = chosen[Math.floor(Math.random()*(chosen.length))];
			//console.log(randsong);
			if (chosen.indexOf(randsong) < chosen.indexOf(item))
				return randsong;
			return item;
		}
	}
	if (type == 4) {
		var songs = new Array();
		var counts = new Array();
		var wins = new Array();
		lists.forEach(function(list) {
			if (list.indexOf(item) >= 0) {
				list.forEach(function(song) {
					if (song != item) { 
						if (songs.indexOf(song) < 0) {
							songs.push(song);
							counts.push(0);
							wins.push(0);
						}
						counts[songs.indexOf(song)] += 1;
						if (list.indexOf(song) < list.indexOf(item))
							wins[songs.indexOf(song)] += 1;
					}
				});
			}
		});
		//console.log(songs);
		//console.log(counts);
		//console.log(wins);
		randint = Math.floor(Math.random()*songs.length);
		//console.log(songs[randint]);
		if (wins[randint]/counts[randint] > 0.5)
			return songs[randint];
		return item;
	}
}

function searchButtonClicked() 
{
	var uri = document.getElementById('uri');
	if (uri.value != '') {
		clearHTML();
		searchTrack(uri.value);
		//scoreTracks();
	}
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
	search.pageSize = 100;

	search.observe(models.EVENT.CHANGE, function() {
  		search.playlists.forEach(function(playlist) {
  			if (playlist.indexOf(trackURI) >= 0) {
   				console.log(playlist.data.getTrackAddTime(0));
   				if (stored_playlists[playlist.uri] == null) {
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
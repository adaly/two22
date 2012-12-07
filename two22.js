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
	
	//console.log(markovStep("B",lists,4));
	//rankAggregation(lists,1,100000);
	//orderPlaylist("spotify:user:jvsirvaitis:playlist:4ETgs7NtjMIJEr1RHhdzKP","spotify:track:3rbNV2GI8Vtd8byhUtXZID");
}

/*
 * PLAYLIST SEARCH CODE
 *
 * searchButtonClicked()
 * searchTrack(uri)
 * searchPlaylists(keyword,trackURI)
 */

function searchButtonClicked() 
{
	var uri = document.getElementById('uri');
	if (uri.value != '') {
		clearHTML();
		var playlists = searchTrack(uri.value);
		//scoreTracks();
		var lists = new Array();
		playlists.forEach(function(pl){
			lists.push(orderPlaylist(pl.uri,uri.value));
		});
		rankAggregation(lists,3,100000);
	}
}

//TODO: Ensure that there are no repeated playlists after merging track, artist, album results
function searchTrack(uri) 
{
	var results = new Array();
	var t = models.Track.fromURI(uri,function(track){
		//Search by name
		console.log('Search by track name:', track.name);
		results.push(searchPlaylists(track.name,uri));

		track.data.artists.forEach(function(artist) 
		{
			//Search by artist
			console.log('Search by artist:', artist.name);
			if (artist.name != track.name)
				results.push(searchPlaylists(artist.name, uri));
		});

		//Search by album
		console.log('Search by album:',track.data.album.name);
		if (track.data.album.name != track.name)
			results.push(searchPlaylists(track.data.album.name, uri));

		addTrackHTML(track);
	});
	
	var pls = new Array();
	results.forEach(function(r){
		r.forEach(function(pl){
			pls.push(pl);
		});
	});
	return pls;
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
	var results = new Array();
	search.localResults = models.LOCALSEARCHRESULTS.IGNORE

	search.searchAlbums = false;
	search.searchArtists = false;
	search.searchTracks = false;
	search.pageSize = 50;

	search.observe(models.EVENT.CHANGE, function() {
  		search.playlists.forEach(function(playlist) {
  			if (playlist.indexOf(trackURI) >= 0 && playlist.length > 1) {
   				//console.log(playlist.data.getTrackAddTime(0));
   				if (stored_playlists[playlist.uri] == null) {
   					addPlaylistHTML(playlist);
   					//analyzePlaylist(playlist);
   					stored_playlists[playlist.uri] = true;
   					
   					results.push(playlist);
   				}
   			}
  		});
	});
	search.appendNext();
	
	return results;
}

/* 
 * RANK AGGREGATION CODE
 *
 * orderPlaylist(playlistURI,trackURI)
 * rankAggregation(lists,type,iter)
 * markovStep(item,lists,type)
 */

function orderPlaylist(playlistURI,trackURI) 
{
	var uris = new Array();
	var pl = models.Playlist.fromURI(playlistURI);
	var tr = models.Track.fromURI(trackURI);
	
	for (var i=0; i<pl.length; i++) {
		var track = pl.get(i);
		if (track.uri != tr.uri)
			uris.push(track.uri);
	}
	return uris;
}

function rankAggregation(lists,type,iter)
{
	var songs = new Array();
	lists.forEach(function(list) {
		list.forEach(function(song) {
			if (songs.indexOf(song) == -1)
				songs.push(song);
		});
	});
	var counts = new Array();
	for (var i=0; i<songs.length; i++)
		counts.push(0);
	for (var i=0; i<iter; i++) {
		var seed = songs[Math.floor(Math.random()*songs.length)];
		var end = markovStep(seed,lists,type);
		counts[songs.indexOf(end)] += 1;
	}
	//console.log(songs);
	//console.log(counts);
	var sorted = counts.slice(0).sort();
	var top = 20;
	for (var i=sorted.length-1; i>=0; i--){
		if (top > 0) {
			var ind = counts.indexOf(sorted[i]);
			console.log(models.Track.fromURI(songs[ind]));
			counts[ind] = -1;
			top--;
		}
	}
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
	// MC4 method
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

function transitionMatrix(lists,type)
{
	var moves = new Array();
	/*if (type == 1) {
		lists.forEach(function(list){
			list.forEach(function(song){
				if (moves[song] == null)
					moves[song] = new Array();
				}
				for (var i=0; i<list.indexOf(song); i++) {
					if (moves[song].indexOf(list[i]) < 0)
						moves[song].push(list[i]);
				}
			});
		});
	}
	if (type == 2) {
		var wins = new Array();
		var counts = new Array();
		lists.forEach(function(list){
			list.forEach(function(song){
				if (wins[song] == null){
					wins[song] = new Array();
					counts[song] = new Array();
				}
				list.forEach(function(competitor){
					if (competitor != song) {
						if (counts[song][competitor] == null){
							counts[song][competitor] = 0;
							wins[song][competitor] = 0;
						}
						counts[song][competitor] += 1;
						if (list.indexOf(competitor) < list.indexOf(song))
							wins[song][competitor] += 1;
					}
				});
			});
		});
		for (var song in wins) {
			moves[song] = new Array();
			for (var competitor in wins[song]) {
				moves[song][competitor] = wins[song][competitor]/counts[song][competitor];
			}
		}
	}*/
	return moves;
}

/*
 * NAIVE COUNT RANKING CODE
 *
 * TrackScore(trackName,score)
 * analyzePlaylist(playlist)
 * scoreTracks()
 */

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

/*
 * HTML MODIFICATION CODE
 * 
 * addPlaylistHTML(playlist)
 * addTrackHTML(track)
 * clearHTML()
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
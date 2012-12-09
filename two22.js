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
		stored_playlists = new Object();
		track_scores = new Object();
		clearHTML();
		var playlists = searchTrack(uri.value);
		//scoreTracks();
		var lists = new Array();
		playlists.forEach(function(pl){
			lists.push(orderPlaylist(pl.uri,uri.value));
		});
		//rankAggregation(lists,3,100000);
		/*var dist = markovChain(lists,4,100);
		var top = topList(dist,20);
		top.forEach(function(song){
			var t = models.Track.fromURI(song, function(track) {
  				addTrackHTML(track);
			});
		});*/
	}
}

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
	
	// Secondary search
	var pls = new Array();
	
	results.forEach(function(r){
		r.forEach(function(pl){
			pls.push(pl);
			for (var i=0; i<pl.length; i++) {
				var tr = pl.get(i);
				if (Math.random() < 0.01)
					searchPlaylists(tr.name,uri).forEach(function(pl2){
						pls.push(pl2);
					});
			}
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
 *
 * markovChain(lists,type,iter)
 * mc1Step(item,moves,avgrankings)
 * mc23Step(item,lists,pluslists,type)
 * mc4Step(item,lists,pluslists,songlist)
 *
 * transitionMatrix(lists,type)
 * getPlusLists(lists)
 * getSongLists(lists)
 *
 */

function orderPlaylist(playlistURI, trackURI) 
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

// order based on time
function orderPlaylist2(playlistURI, trackURI) 
{
	var uris = new Array();
	var pl = models.Playlist.fromURI(playlistURI);
	var tr = models.Track.fromURI(trackURI);
	var index = pl.indexOf(tr);
	var time = playlist.data.getTrackAddTime(index);

	for (var i=0; i<pl.length; i++) 
	{
		var track = pl.get(i);
		if (track.uri != tr.uri)
		{
			time1 = playlist.data.getTrackAddTime(i);
			uris.push([track.uri, Math.abs(time1 - time)]);
		}
	}
	// NEED TO ADD SORT HERE
	uris.sort(function(a, b) {return a[1] - b[1];})
	return uris;
}

// Finds a stationary distribution over Markov chain
// Starts with a count of 10 for each item, then iterates taking Markov steps and updating distribution
function markovChain(lists,type,iter){
	//Initial uniform random distribution
	var dist = new Array();
	lists.forEach(function(list){
		list.forEach(function(song){
			dist[song] = 10;
		});
	});
	
	// Computes preprocessing data as necessary
	if (type == 1) {
		var moves = transitionMatrix(lists,type);
		var avgrankings = avgRankings(lists);
	}
	if (type == 2 || type == 3 || type == 4) {
		var pluslists = getPluslists(lists);
	}
	if (type == 4) {
		var songlist = getSongList(lists);
	}
	
	// For each song, computes dist[song] random steps, then builds a new distribution
	var newdist = new Array();
	for (var i=0; i<iter; i++) {
		for (var key in dist)
			newdist[key] = 0;
		for (var key in dist){
            for (var j=0; j<dist[key]; j++) {
          		var step;
        		if (type == 2 || type == 3)
        			step = mc23Step(key,lists,pluslists[key],type);
            	if (type == 1)
            		step = mc1Step(key,moves,avgrankings);
            	if (type == 4)
            		step = mc4Step(key,lists,pluslists,songlist);
            	newdist[step]++;
        	}
    	}
    	// New distribution taken to next iteration
    	for (var key in dist) {
    		dist[key] = newdist[key];
    		//console.log(dist[key]);
    	}
	}
	if (type==4)
		console.log(songlist.length);
	return dist;
}

// Given a dictionary of arrays of moves and a dictionary of the average rankings of items, returns a random MC1 move
function mc1Step(item,moves,avgrankings)
{
	var step = moves[item][Math.floor(Math.random()*moves[item].length)];
    if (Math.random() <= 1/(avgrankings[item]))
        step = item; 
    return step;
}

function mc23Step(item,lists,pluslists,type)
{
	if (type == 2 || type == 3) {
		if (pluslists.length == 0)
			return item;
		var chosen = lists[pluslists[Math.floor(Math.random()*pluslists.length)]];
		if (type == 2)
			return chosen[Math.floor(Math.random()*(chosen.indexOf(item)+1))];
		if (type == 3) {
			randsong = chosen[Math.floor(Math.random()*(chosen.length))];
			if (chosen.indexOf(randsong) < chosen.indexOf(item))
				return randsong;
			return item;
		}
	}
}

function mc4Step(item,lists,pluslists,songlist)
{
	var randsong = songlist[Math.floor(Math.random()*songlist.length)];
	var wins = 0; var counts = 0;
	pluslists[item].forEach(function(listind){
		var rind = lists[listind].indexOf(randsong);
		if (rind >= 0){
			counts++;
			if (rind < lists[listind].indexOf(item))
				wins++;
		}
	});
	if (counts > 0 && wins > counts/2)
		return randsong;
	else
		return item;
}

// Returns a dictionary of {song:songs ranked higher on some list}
function transitionMatrix(lists,type)
{
	var moves = new Array();
	// Computes a dictionary that returns an array of possible moves given a song
	if (type == 1) {
		lists.forEach(function(list){
			list.forEach(function(song){
				moves[song] = new Array();
			});
		});
		lists.forEach(function(list){
			list.forEach(function(song){
				for (var i=0; i<list.indexOf(song); i++) {
					if (moves[song].indexOf(list[i]) < 0)
						moves[song].push(list[i]);
				}
			});
		});
	}
	return moves;
}

// Returns a dictionary of {song:indices of lists that contain it}
function getPluslists(lists)
{
	var pluslists = new Array();
	lists.forEach(function(list){
		list.forEach(function(song){
			pluslists[song] = new Array();
		});
	});
	lists.forEach(function(list){
		var i = lists.indexOf(list);
		list.forEach(function(song){
			if (pluslists[song].indexOf(i) < 0)
				pluslists[song].push(i);
		});
	});
	return pluslists;	
}

function getSongList(lists)
{
	var songs = new Array();
	lists.forEach(function(list){
		list.forEach(function(song){
			if (songs.indexOf(song) < 0)
				songs.push(song);
		});
	});
	return songs;
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

/*
 * HELPER FUNCTIONS
 *
 * randomKey(obj)
 * avgRankings(lists)
 * getUser(playlist)
 */

function randomKey(obj) {
    var ret;
    var c = 0;
    for (var key in obj)
        if (Math.random() < 1/++c)
           ret = key;
    return ret;
}

// Computes average ranking of all items in the list
function avgRankings(lists) {
	var counts = new Array();
	var nlists = new Array();
	lists.forEach(function(list){
		list.forEach(function(song){
			counts[song] = 0;
			nlists[song] = 0;
		});
	});
	lists.forEach(function(list){
		list.forEach(function(song){
			ind = list.indexOf(song);
			if (ind >= 0) {
				counts[song] += (ind+1);
				nlists[song] += 1
			}
		});
	});
	for (var key in counts)
		counts[key] = counts[key]/nlists[key];
	return counts;
}

// Given a distribution (dictionary of song:relevance) outputs top num songs
function topList(dist,num)
{
	var top = new Array();
	while (top.length < num){
		var max = 0;
		var maxkey;
		for (var key in dist){
			if (dist[key] > max && top.indexOf(key) < 0){
				max = dist[key];
				maxkey = key;
			}
		}
		top.push(maxkey);
	}
	return top;
}

// Returns the user of a playlist object
function getUser(playlist)
{
	var tokens = playlist.uri.split(":playlist:");
	return tokens[0];
}

/*
 * DEFUNCT CODE
 */

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
	// DO NOT USE! Precompute transition matrix and use mc1Step instead.
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
	// DO NOT USE! Precompute transition matrix and use mc4Step instead.
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
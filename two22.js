var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');

exports.init = init;

function init() {
	//searchPlaylists('Clique');
	searchTrack('spotify:track:3rbNV2GI8Vtd8byhUtXZID');
}

//TODO: Ensure that there are no repeated playlists after merging track, artist, album results
function searchTrack(uri) {
	var t = models.Track.fromURI(uri,function(track){
		//Search by name
		console.log('Track loaded:',track.name);
		searchPlaylists(track.name,uri);
		
		track.data.artists.forEach(function(artist) {
			//Search by artist
			console.log(artist.name);
			if (artist.name != track.name)
				searchPlaylists(artist.name,uri);
		});
		
		//Search by album
		console.log('Album:',track.data.album.name);
		if (track.data.album.name != track.name)
			searchPlaylists(track.data.album.name,uri);
		
		addTrackHTML(track);
		
	});
}

/*
 * Searches for all playlists by a given keyword containing the specified track, then
 * adds them to the HTML and returns a list of their URIs
 */
//TODO: Modify to take a list of URIs and check if ANY of them are in the playlist
//TODO: Expand search to other playlists created by the same user (can we search by user? I can parse the user ID from the playlist ID)
function searchPlaylists(keyword,trackURI) {
	var search = new models.Search(keyword);
	search.localResults = models.LOCALSEARCHRESULTS.IGNORE
	
	search.searchAlbums = false;
	search.searchArtists = false;
	search.searchTracks = false;
	search.pageSize = 50;
	
	var results = new Array();
		
	search.observe(models.EVENT.CHANGE, function() {
  		search.playlists.forEach(function(playlist) {
  			if (playlist.indexOf(trackURI) >= 0) {
   				console.log(playlist.name,playlist.data.subscriberCount,"subscribers");
   				if (results.indexOf(playlist.uri) < 0) {
   					addPlaylistHTML(playlist);
   					results.push(playlist.uri);
   				}
   			}
  		});
	});
	search.appendNext();
	
	return results;
}

/*
 * Creates an href for a given playlist and inserts it into the 'results' list HTML
 */
function addPlaylistHTML(playlist) {
	resultsList = document.getElementById('results');
	
	var link = document.createElement('li');
   	var a = document.createElement('a');
   	a.href = playlist.uri;
   	link.appendChild(a);
   	a.innerHTML = playlist.name+" - "+playlist.data.subscriberCount+" subscribers";
   	resultsList.appendChild(link);
}

function addTrackHTML(track) {
	info = document.getElementById('trackInfo');

	var link = document.createElement('li');
   	var a = document.createElement('a');
   	a.href = track.uri;
   	link.appendChild(a);
   	a.innerHTML = track.name;
   	info.appendChild(link);
}
$(function(){

	// This demo depends on the canvas element
	if(!('getContext' in document.createElement('canvas'))){
		alert('Sorry, it looks like your browser does not support canvas!');
		return false;
	}

	// The URL of your web server (the port is set in app.js)
	var url = 'http://localhost:8080';
	//var url ='http://warm-ravine-1633.herokuapp.com/'

	var doc = $(document),
		win = $(window),
		canvas = $('#paper'),
		ctx = canvas[0].getContext('2d'),
		instructions = $('#instructions');
	
	// Generate an unique ID
	var id = Math.round($.now()*Math.random());
	
	// A flag for drawing activity
	var drawing = false;

  // flag for text entry mode
  var textEntryMode = false;

	var clients = {};
	var cursors = {};
  var activeTextBoxes = {};

	var socket = io.connect(url);
	
	socket.on('moving', function (data) {
		
		if(! (data.id in clients)){
			// a new user has come online. create a cursor for them
			cursors[data.id] = $('<div class="cursor">').appendTo('#cursors');
		}
		
		// Move the mouse pointer
		cursors[data.id].css({
			'left' : data.x,
			'top' : data.y
		});
		
		// Is the user drawing?
		if(data.drawing && clients[data.id]){
			
			// Draw a line on the canvas. clients[data.id] holds
			// the previous position of this user's mouse pointer
			
			drawLine(clients[data.id].x, clients[data.id].y, data.x, data.y);
		}
		
		// Saving the current client state
		clients[data.id] = data;
		clients[data.id].updated = $.now();
	});

  //draw text from other clients 
  socket.on('writeText', function(data){

      console.log('got text: '+data.text);
    if (activeTextBoxes[data.id] != data.activeTextId){
      // need to create new box
      showReadOnlyTextArea(data.x, data.y, data.text, data.activeTextId)
      activeTextBoxes[data.id] = data.activeTextId;
    } else {
      // text box is already active, update the value
      var box = $('#'+activeTextBoxes[data.id]);
      box.val(data.text); 
    }
  });

	var prev = {};
	
	canvas.on('mousedown',function(e){
		e.preventDefault();
		drawing = true;
		prev.x = e.pageX;
		prev.y = e.pageY;
	
    // end text entry mode
    textEntryMode = false;
    closeTextArea();
	
		// Hide the instructions
		instructions.fadeOut();
	});

	var textStartPoint = {};
  var acaumulatedChars = [];

  canvas.on('dblclick', function(e){
    //close previous text area
    closeTextArea();

    //begin text entry
    textEntryMode = true;
    textStartPoint.x = e.pageX;
    textStartPoint.y = e.pageY;
    createNewWritableTextArea(e.pageX, e.pageY);
  });
	

	doc.bind('mouseup mouseleave',function(){
		drawing = false;
	});

	var lastEmit = $.now();

	doc.on('mousemove',function(e){
		if($.now() - lastEmit > 30){
			socket.emit('mousemove',{
				'x': e.pageX,
				'y': e.pageY,
				'drawing': drawing,
				'id': id
			});
			lastEmit = $.now();
		}
		
		// Draw a line for the current user's movement, as it is
		// not received in the socket.on('moving') event above
		
		if(drawing){
			
			drawLine(prev.x, prev.y, e.pageX, e.pageY);
			
			prev.x = e.pageX;
			prev.y = e.pageY;
		}
	});

	// Remove inactive clients after 10 seconds of inactivity
	setInterval(function(){
		
		for(ident in clients){
			if($.now() - clients[ident].updated > 10000){
				
				// Last update was more than 10 seconds ago. 
				// This user has probably closed the page
				
				cursors[ident].remove();
				delete clients[ident];
				delete cursors[ident];
			}
		}
		
	},10000);

	function drawLine(fromx, fromy, tox, toy){
		ctx.moveTo(fromx, fromy);
		ctx.lineTo(tox, toy);
		ctx.stroke();
	}

  var textEntry;

  function closeTextArea(){
    //close old text area
    if (textEntry){
      // disable the element and remove listeners
      textEntry.prop('readonly', true);
      textEntry.off('input');
    }
  }

  function showReadOnlyTextArea(x, y, value, id){
    var box = createTextArea(x, y, value, id);
    box.prop('readonly', true);
    return box;
  }

  var textAreaCount = 1;

  function createNewWritableTextArea(x, y){
    textAreaCount++;
    var currentTextAreaId = id*textAreaCount;

    textEntry = createTextArea(x, y, "", currentTextAreaId); 
    textEntry.focus();
    textEntry.on('input', function(e){
      if (textEntryMode){
        // emit to socket here
        socket.emit('textEntry', {
          'text': textEntry.val(), 
          'x': textStartPoint.x,
          'y': textStartPoint.y,
          'id': id,
          'activeTextId': textEntry.attr('id') 
        });
			  lastEmit = $.now();
      }
    });
  }

  function createTextArea(x, y, value, id){
    var o = {
      'left': x,
      'top': y
    };

    $('body').append("<input id='"+id+"' value='"+value+"' class='textArea' type = 'text'/>");
    var box = $('#'+id);
    box.show(2000).offset(o);
    return box;
  }

});

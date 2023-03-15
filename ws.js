const WsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    init: function(port, debug, debugFilters) {
        port = port || 49122;
        debug = debug || false;
        if (debug) {
            if (debugFilters !== undefined) {
                console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
            } else {
                console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
            }
        }
        WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
        WsSubscribers.webSocket.onmessage = function (event) {
            let jEvent = JSON.parse(event.data);
            if (!jEvent.hasOwnProperty('event')) {
                return;
            }
            let eventSplit = jEvent.event.split(':');
            let channel = eventSplit[0];
            let event_event = eventSplit[1];
            //if (debug) {
            //    if (!debugFilters) {
            //        console.log(channel, event_event, jEvent);
            //    } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
            //        console.log(channel, event_event, jEvent);
            //    }
            //}
            WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        WsSubscribers.webSocket.onopen = function () {
            WsSubscribers.triggerSubscribers("ws", "open");
            WsSubscribers.webSocketConnected = true;
            WsSubscribers.registerQueue.forEach((r) => {
                WsSubscribers.send("wsRelay", "register", r);
            });
            WsSubscribers.registerQueue = [];
        };
        WsSubscribers.webSocket.onerror = function () {
            WsSubscribers.triggerSubscribers("ws", "error");
            WsSubscribers.webSocketConnected = false;
        };
        WsSubscribers.webSocket.onclose = function () {
            WsSubscribers.triggerSubscribers("ws", "close");
            WsSubscribers.webSocketConnected = false;
        };
    },
    /**
     * Add callbacks for when certain events are thrown
     * Execution is guaranteed to be in First In First Out order
     * @param channels
     * @param events
     * @param callback
     */
    subscribe: function(channels, events, callback) {
        if (typeof channels === "string") {
            let channel = channels;
            channels = [];
            channels.push(channel);
        }
        if (typeof events === "string") {
            let event = events;
            events = [];
            events.push(event);
        }
        channels.forEach(function(c) {
            events.forEach(function (e) {
                if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                    WsSubscribers.__subscribers[c] = {};
                }
                if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                    WsSubscribers.__subscribers[c][e] = [];
                    if (WsSubscribers.webSocketConnected) {
                        WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                    } else {
                        WsSubscribers.registerQueue.push(`${c}:${e}`);
                    }
                }
                WsSubscribers.__subscribers[c][e].push(callback);
            });
        })
    },
    clearEventCallbacks: function (channel, event) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel] = {};
        }
    },
    triggerSubscribers: function (channel, event, data) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel][event].forEach(function(callback) {
                if (callback instanceof Function) {
                    callback(data);
                }
            });
        }
    },
    send: function (channel, event, data) {
        if (typeof channel !== 'string') {
            console.error("Channel must be a string");
            return;
        }
        if (typeof event !== 'string') {
            console.error("Event must be a string");
            return;
        }
        if (channel === 'local') {
            this.triggerSubscribers(channel, event, data);
        } else {
            let cEvent = channel + ":" + event;
            WsSubscribers.webSocket.send(JSON.stringify({
                'event': cEvent,
                'data': data
            }));
        }
    }
};
/// GLOBAL INFO

///

$(() => {
    WsSubscribers.init(49122, true);
    
    WsSubscribers.subscribe("game", "update_state", (d) => {

        // Score
        $(".team-blue-score").text(d['game']['teams'][0]['score']);
        $(".team-orange-score").text(d['game']['teams'][1]['score']);

        // Team Name
        $(".team-blue-name").text(d['game']['teams'][0]['name']);
        $(".team-orange-name").text(d['game']['teams'][1]['name']);

        // AutoSize Team Names
        textFit(document.getElementById("tno"));
        textFit(document.getElementById("tnb"));

        // Cock
        let gameTime = JSON.parse(d['game']['time_seconds']);
        let m = ('0' + Math.floor(gameTime / 60)).slice(-3);
        let s = ('0' + Math.round(gameTime % 60)).slice(-2);

        let clock = document.getElementById("time")

        if (clock) {
            clock.innerHTML = `${m}:${s.length !== 1 ? s : "0" + s}`
          }

        // Players
        let playerList = d.players;
        let team0 = _.filter(playerList, {
            'team': 0
        });

        
        let team1 = _.filter(playerList, {
            'team': 1
        });


        // Get Team Colors

        let bTeamColor = "#" + d['game']['teams'][0]['color_primary'];
        let oTeamColor = "#" + d['game']['teams'][1]['color_primary'];

        //Assign Team Color to CSS
        $(':root').css('--teamColor-blue', bTeamColor);
        $(':root').css('--teamColor-orange', oTeamColor);


        // Active Player

        let activeTarget = d.game.target;
        let activePlayerData = _.get(playerList, activeTarget);

        if (activeTarget.length < 1)
        {}
        else
        {
            document.getElementById("name").innerHTML = activePlayerData.name;
            document.getElementById("score").innerHTML = activePlayerData.score + '<div class="stat-text"> score</div>';
            document.getElementById("goals").innerHTML = activePlayerData.goals <= 1 ? activePlayerData.goals + '<div class="stat-text"> goal</div>' : activePlayerData.goals + '<div class="stat-text"> goals</div>';
            document.getElementById("assist").innerHTML = activePlayerData.assists <= 1 ? activePlayerData.assists + '<div class="stat-text"> assist</div>' : activePlayerData.goals + '<div class="stat-text"> assists</div>';

            // Init Player Boost
            let bar = new ldBar("#current-player-boost");
            bar.set(activePlayerData.boost);

            // Color by Spectated team
            activePlayerData.team <= 0 ? $(':root').css('--theme-test', bTeamColor) : $(':root').css('--theme-test', oTeamColor);
        }

        // Info Grabber
        let team0p1 = team0[0];
        let team0p2 = team0[1];
        let team0p3 = team0[2];

        let team1p1 = team1[0];
        let team1p2 = team1[1];
        let team1p3 = team1[2];


        document.getElementById("name-p1").innerHTML = team0p1.name;
        document.getElementById("name-p2").innerHTML = team0p2.name;
        document.getElementById("name-p3").innerHTML = team0p3.name;
        document.getElementById("name-p4").innerHTML = team1p1.name;
        document.getElementById("name-p5").innerHTML = team1p2.name;
        document.getElementById("name-p6").innerHTML = team1p3.name;

        document.getElementById("p1").style = "width: " + team0p1.boost + "%";
        document.getElementById("p2").style = "width: " + team0p2.boost + "%";
        document.getElementById("p3").style = "width: " + team0p3.boost + "%";
        document.getElementById("p4").style = "width: " + team0p1.boost + "%";
        document.getElementById("p5").style = "width: " + team0p2.boost + "%";
        document.getElementById("p6").style = "width: " + team0p3.boost + "%";


        // Boost Total

        let team0Boost = 0;

        team0.forEach(element => team0Boost = team0Boost + element.boost);

        let team1Boost = 0;

        team1.forEach(element => team1Boost = team1Boost + element.boost);

        let combinedTotal = team1Boost + team0Boost;

        let bOfTotal = ((100 / combinedTotal)* team0Boost);
        let oOfTotal = ((100 / combinedTotal)* team1Boost);

        document.getElementById("pbar").style = "width: " + bOfTotal + "%";


        if (!document.getElementById("tib").firstChild)
        {
            var myImage = new Image(75, 75);
            myImage.src = 'https://i.redd.it/f8fchc9lepx51.jpg';
            document.getElementById("tib").appendChild(myImage);
        }

        if (!document.getElementById("tio").firstChild)
        {
            var myImage = new Image(75, 75);
            myImage.src = 'https://i.redd.it/f8fchc9lepx51.jpg';
            document.getElementById("tio").appendChild(myImage);
        }
    });
});

function playerCard (showCard, num) {
    let direction = ""   
    num <= 0 ? direction = "left" : direction = "right"
    document.getElementById(showCard).style = "position: absolute;"+ direction + ":140px;width:300px!important;height:400px!important;"
}

function clockHasStopped () {
    document.getElementById("current-player").style.visibility = "hidden";
    document.getElementById("current-player-boost").style.visibility = "hidden";
    document.getElementById("progress-wrapper-blue").style.left = "-140px";
    document.getElementById("progress-wrapper-orange").style.right = "-140px";
}

function clockHasStarted (showCard) {
    document.getElementById("current-player").style.visibility = "visible";
    document.getElementById("current-player-boost").style.visibility = "visible";
    document.getElementById("progress-wrapper-blue").style.left = "0px";
    document.getElementById("progress-wrapper-orange").style.right = "0px";
    document.getElementById(showCard).style = ""
}

WsSubscribers.subscribe("game", "goal_scored", (goal) => {
    let goalScorer = goal.scorer.name;
    let teamNumber = goal.scorer.teamnum;
    let cardToShow = "";
    if (goalScorer == team0p1.name){cardToShow = "card-1"};
    if (goalScorer == team0p2.name){cardToShow = "card-2"};
    if (goalScorer == team0p3.name){cardToShow = "card-3"};
    if (goalScorer == team1p1.name){cardToShow = "card-4"};
    if (goalScorer == team1p2.name){cardToShow = "card-5"};
    if (goalScorer == team1p3.name){cardToShow = "card-6"};
    setTimeout(playerCard(cardToShow, teamNumber), 2000);
});

WsSubscribers.subscribe("game", "pre_countdown_begin", (start) => {
    clockHasStarted(cardToShow)
});

WsSubscribers.subscribe("game", "clock_stopped", (stopped) => {
   clockHasStopped()
});

//.progress-card-test {
//    position: absolute;
//    left: 140px!important;
//    width:300px!important;
//    height: 400px!important;
//  }
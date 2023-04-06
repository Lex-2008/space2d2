import { default as PocketBase, RecordAuthResponse } from "../pocketbase/pocketbase.es.mjs";
import { draw_star } from "./draw.js";
import { flightplan, redrawFlightplan } from "./flightplan.js";
import { setupHints, set_shown_star, shown_star } from "./hints.js";
import { check, default_universe, loadUniverse, moveToNewStar, player_star, SaveData, saveUniverse, set_player_star, stats } from "./universe.js";

import textFit from '../textFit/textFit.js';

export function gebi(id: string) {
    const element = document.getElementById(id);
    if (!element) throw ReferenceError(`element ${id} not found`);
    return element;
}
export function gibi(id: string) {
    const element = gebi(id);
    if (!(element instanceof HTMLInputElement)) throw ReferenceError(`element ${id} is not input`);
    return element;
}

export var mode: string;

var c = gebi("myCanvas") as HTMLCanvasElement;
var ctx = c.getContext("2d") as CanvasRenderingContext2D;

var real_savegame_id: string;
var flyi_time: number;
var flyi_finish: number;
var flyi_interval: number;
if (location.hostname == 'localhost') {
    flyi_time = 1000 * 60 * 10; //10min
} else {
    flyi_time = 1000 * 60 * 60 * 10; //10h
}
export function redraw() {
    draw_star(ctx, shown_star);
    setupHints(shown_star, c, gebi('hints'));
    redrawFlightplan();
    gebi('mapTitle_player').style.display = (shown_star == player_star) ? '' : 'none';
    gebi('mapTitle_neighbour').style.display = (shown_star == player_star) ? 'none' : '';
    if (shown_star != player_star) {
        gebi('mapTitle_neighbour_n').innerText = '' + (player_star.neighbours.indexOf(shown_star) + 1);
        gebi('mapTitle_neighbour_total').innerText = '' + player_star.neighbours.count;
    }
    gebi('stats_s').innerText = '' + stats.s;
    gebi('stats_p').innerText = '' + stats.p;
    gebi('stats_js').innerText = '' + stats.js;
    gebi('stats_jf').innerText = '' + stats.jf;
    gebi('stats_jf_s').innerText = '' + Math.round(stats.jf / stats.s * 100) / 100;
    gebi('stats_jf_p').innerText = '' + Math.round(stats.jf / stats.p * 100);
    gebi('stats_jf_js').innerText = '' + Math.round(stats.jf / stats.js * 100);
    // gebi('stats_mr').innerText=stats.mr;
    // gebi('stats_mrc').innerText=stats.mrc;
    // gebi('stats_mrc_show').style.display=stats.mrc>1?'':'none';
}

window.onhashchange = async function () {
    document.querySelectorAll('dialog[open]').forEach(x => (x as HTMLDialogElement).close())
    gebi('main').style.display = 'none';
    flyi_switch(false);
    gebi('profile').style.display = 'none';

    mode = location.hash.slice(1);
    if (['test', 'easy', 'hard', 'real'].indexOf(mode) == -1) {
        history.replaceState(0, '', location.pathname);
        (gebi('select_mode') as HTMLDialogElement).showModal();
        return;
    }
    document.title += ` - ${mode} mode`;

    save_game = simple_save_game;

    if (mode == 'test') return start_game(JSON.parse(default_universe));
    if (['easy', 'hard'].indexOf(mode) > -1) return start_game(JSON.parse(localStorage['space2d2' + mode] || default_universe));

    // REAL mode

    const m = await import('../pocketbase/pocketbase.es.mjs'); //TODO: error
    const PocketBase = m.default;
    var pb: PocketBase;
    if (location.hostname == 'localhost') {
        pb = new PocketBase('http://127.0.0.1:8090');
    } else {
        pb = new PocketBase('/');
    }
    window.pb = pb;

    save_game = async function () {
        console.log('real mode save_game');
        // TODO: error checking
        if (real_savegame_id) {
            pb.collection('real').update(real_savegame_id, {
                data: saveUniverse(),
            });
        } else {
            var r = await pb.collection('real').create({
                user: pb.authStore.model.id,
                data: saveUniverse(),
            });
            real_savegame_id = r.id;
        }
    };

    pb.collection('users').authRefresh({}, { expand: 'real(user)' }).then(
        start_real_game,
        () => setup_login_flow(pb));
}

function setup_login_flow(pb: PocketBase) {
    window.login = function () {
        pb.collection('users').authWithPassword(
            gibi('login_email').value,
            gibi('login_password').value,
            {}, { expand: 'real(user)' }
        ).then((r) => {
            (gebi('login') as HTMLDialogElement).close();
            start_real_game(r);
        }, (e) => {
            console.log(e);
            gibi('login_failure').style.display = '';
            gibi('login_details').innerText = JSON.stringify(e.response, null, 2);
        });
    };
    window.register = function () {
        pb.collection('users').create({
            email: gibi('register_email').value,
            emailVisibility: true,
            password: gibi('register_password').value,
            passwordConfirm: gibi('register_password').value,
        }).then(async (r) => {
            gibi('login_email').value = gibi('register_email').value;
            gibi('login_password').value = gibi('register_password').value;
            (gebi('register') as HTMLDialogElement).close();
            (gebi('register_to_login') as HTMLDialogElement).showModal();
        }, (e) => {
            console.log(e);
            gebi('register_failure').style.display = '';
            gebi('register_details').innerText = JSON.stringify(e.response, null, 2);
        });
    };
    (gebi('login') as HTMLDialogElement).showModal();
}

function start_real_game(r: RecordAuthResponse) {
    const ex = r.record.expand['real(user)'];
    gebi('profile').style.display = '';
    gebi('profile_name').innerText = r.record.email;
    gebi('profile_id').innerText = r.record.id;
    if (!ex || !ex.data) {
        return start_game(JSON.parse(default_universe));
    }
    real_savegame_id = ex.id;
    flyi_finish = new Date(ex.updated).getTime() + flyi_time;
    if (flyi_finish <= new Date().getTime()) {
        return start_game(ex.data);
    }
    start_game(ex.data);
    flyi_switch(true);
}

function flyi_step() {
    const flyi_remain = flyi_finish - new Date().getTime();
    (gebi('flyi_time').firstChild as HTMLSpanElement).innerText = '' + new Date(flyi_remain).toISOString().substring(11, 19);
    if (flyi_remain <= 1000) flyi_switch(false);
}

function flyi_switch(on: boolean) {
    gebi('mapTitle_flying').style.display = on ? '' : 'none';
    gebi('mapTitle_player').style.display = on ? 'none' : '';
    gebi('fpTitle_normal').style.display = on ? 'none' : '';
    gebi('fpTitle_flyi').style.display = on ? '' : 'none';
    gebi('myFlightplan').style.display = on ? 'none' : '';
    gebi('fp_hint').style.display = on ? 'none' : '';
    gebi('fp_flyi').style.display = on ? '' : 'none';
    gebi('player_here').style.display = on ? 'none' : '';
    mode = on ? 'flyi' : 'real';
    if (on) {
        textFit(gebi('flyi_time'), { detectMultiLine: false, widthOnly: true });
        gebi('flyi_cargo_with').style.display = flightplan.steps[0].cargo ? '' : 'none';
        gebi('flyi_cargo').innerText = flightplan.steps[0].cargo || '';
        flyi_interval = setInterval(flyi_step, 1000);
        flyi_step();
        window.showhide_youtube(gebi('youtube_details')); // add YT player if dialog was open
    } else {
        clearInterval(flyi_interval);
        gebi('youtube_player').innerText = ''; // remove YT player no matter if dialog was open or not
    }
}

window.showhide_youtube = function (details: HTMLDetailsElement) {
    gebi('youtube_player').innerText = '';
    if (!details.open) return;
    const flyi_progress = flyi_time - (flyi_finish - new Date().getTime());
    gebi('youtube_player').innerHTML = `<iframe width="530" height="315" src="https://www.youtube-nocookie.com/embed/fTySVh_47Ak?autoplay=1&start=${Math.round(flyi_progress / 1000)}" style="transform: scale(0.42);transform-origin: 0 0" allowfullscreen></iframe>`;
}

function start_game(universe: SaveData) {
    gebi('main').style.display = 'flex';
    loadUniverse(universe);
    if (!check())
        alert('universe error, check console');
    set_shown_star(player_star);
    redraw();
}

var save_game: () => void;

var simple_save_game = function () {
    localStorage['space2d2' + mode] = JSON.stringify(saveUniverse());
};

function jump_start() {
    if (shown_star == player_star) return;
    if (shown_star.visited) return;
    stats.s++;
    stats.p += flightplan.steps.length - 1;
    stats.jf += flightplan.countJobs();
    stats.js += player_star.jobs;
    console.clear();
    const target_star = shown_star;
    // draw old player star before moveToNewStar turns some portals disabled
    set_shown_star(player_star);
    flightplan.exitPortal = player_star.neighbours.directionOf(target_star);
    redraw();
    gebi('player_travel_css').innerHTML = `@keyframes player_travel {${flightplan.toKeyFrames()}}`;
    gebi('player_here').style.display = 'none';
    // update game state and maybe save it
    moveToNewStar(target_star, player_star);
    var lastCargo = flightplan.lastStep.cargo;
    var direction = target_star.neighbours.directionOf(player_star);
    flightplan.init(direction.x, direction.y, lastCargo, gebi('myFlightplan') as HTMLDivElement);
    player_star.visited = true;
    set_player_star(target_star);
    if (!check()) alert('universe error, check console');
    if (mode != 'real' || stats.s != 1) {
        save_game();
        flyi_finish = new Date().getTime() + flyi_time;
    }
    // start animation
    gebi('player_travel').style.display = '';
    gebi('player_travel').onanimationend = jump_end;
}

function jump_end() {
    gebi('player_travel').style.display = 'none';
    set_shown_star(player_star);
    redraw();
    if (mode != 'real') return;
    // for REAL mode
    if (stats.s == 1) {
        return (gebi('real_nosave') as HTMLDialogElement).showModal();
    }
    save_game();
    flyi_switch(true);
}

function jump() {
    if (shown_star == player_star) return;
    if (shown_star.visited) return;
    stats.s++;
    stats.p += flightplan.steps.length - 1;
    stats.jf += flightplan.countJobs();
    stats.js += player_star.jobs;
    console.clear();
    moveToNewStar(shown_star, player_star);
    var lastCargo = flightplan.lastStep.cargo;
    var direction = shown_star.neighbours.directionOf(player_star);
    flightplan.init(direction.x, direction.y, lastCargo, gebi('myFlightplan') as HTMLDivElement);
    player_star.visited = true;
    set_player_star(shown_star);
    if (!check()) alert('universe error, check console');
    redraw();
    if (mode != 'real') {
        return save_game();
    }
    // for REAL mode
    if (stats.s == 1) {
        return (gebi('real_nosave') as HTMLDialogElement).showModal();
    }
    save_game()
    flyi_finish = new Date().getTime() + flyi_time;
    flyi_switch(true);
}

window.onhashchange();

window.jump = jump_start;
window.redraw = redraw;
window.flightplan = flightplan;
window.redrawFlightplan = redrawFlightplan;
window.set_shown_star = set_shown_star;
window.get_shown_star = () => shown_star;
window.player_star = player_star;
window.get_player_star = () => player_star;


if (location.hostname == 'localhost') {
    new EventSource('/esbuild').addEventListener('change', () => location.reload());
}
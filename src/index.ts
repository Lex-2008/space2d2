import pocketbaseEs, { RecordAuthResponse } from "../js-sdk/dist/pocketbase.es.mjs";
import { Direction } from "./angle.js";
import { draw_star } from "./draw.js";
import { flightplan, redrawFlightplan } from "./flightplan.js";
import { setupHints, set_shown_star, shown_star } from "./hints.js";
import { Star } from "./stars.js";
import { check, default_universe, loadUniverse, moveToNewStar, player_star, saveUniverse, set_player_star, stats } from "./universe.js";

export function gebi(id: string) {
    const element = document.getElementById(id);
    if (!element) throw ReferenceError(`element ${id} not found`);
    return element;
}

export var mode: string;

var c = gebi("myCanvas") as HTMLCanvasElement;
var ctx = c.getContext("2d") as CanvasRenderingContext2D;

var real_savegame_id: string;
const flyi_time = 1000 * 60 * 60 * 10; //10h
//const flyi_time = 1000 * 60 * 10; //10min
var flyi_finish: number;
var flyi_interval: number;

export function redraw() {
    draw_star(ctx, shown_star);
    setupHints(shown_star, c, gebi('hints'));
    redrawFlightplan();
    gebi('mapTitle_player').style.display = (shown_star == player_star) ? '' : 'none';
    gebi('mapTitle_neighbour').style.display = (shown_star == player_star) ? 'none' : '';
    if (shown_star != player_star) {
        gebi('mapTitle_neighbour_n').innerText = '' + player_star.neighbours.indexOf(shown_star) + 1;
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
    mode = location.hash.slice(1);
    if (['test', 'easy', 'hard', 'real'].indexOf(mode) == -1) {
        history.replaceState(0, '', location.pathname);
        (gebi('select_mode') as HTMLDialogElement).showModal();
        return;
    }

    if (mode == 'test') return start_game(JSON.parse(default_universe));
    if (['easy', 'hard'].indexOf(mode) > -1) return start_game(JSON.parse(localStorage['space2d2' + mode] || default_universe));

    // REAL mode

    const m = await import('../js-sdk/dist/pocketbase.es.mjs');
    const PocketBase = m.default;
    const pb = new PocketBase('http://127.0.0.1:8090');

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

function setup_login_flow(pb: pocketbaseEs) {
    window.login = function () {
        pb.collection('users').authWithPassword(
            gebi('login_email').value,
            gebi('login_password').value,
            {}, { expand: 'real(user)' }
        ).then((r) => {
            (gebi('login') as HTMLDialogElement).close();
            start_real_game(r);
        }, (e) => {
            console.log(e);
            gebi('login_failure').style.display = '';
            gebi('login_details').innerText = JSON.stringify(e.response, null, 2);
        });
    };
    window.register = function () {
        pb.collection('users').create({
            username: gebi('register_username').value,
            email: gebi('register_email').value,
            password: gebi('register_password').value,
            passwordConfirm: gebi('register_password').value,
        }).then(async (r) => {
            if (gebi('register_username').value) {
                gebi('login_email').value = gebi('register_username').value;
            }
            if (gebi('register_email').value) {
                gebi('login_email').value = gebi('register_email').value;
            }
            gebi('login_password').value = gebi('register_password').value;
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
    if (!ex || !ex.data) {
        return start_game(JSON.parse(default_universe));
    }
    real_savegame_id = ex.id;
    flyi_finish = new Date(ex.updated).getTime() + flyi_time;
    if (flyi_finish <= new Date().getTime()) {
        return start_game(ex.data);
    }
    mode = 'flyi';
    start_game(ex.data);
    flyi_switch(true);
    flyi_step();
    flyi_interval = setInterval(flyi_step, 1000);
}

function flyi_step() {
    const flyi_remain = flyi_finish - new Date().getTime();
    gebi('flyi_time').innerText = '' + new Date(flyi_remain).toISOString().substring(11, 19);
    if (flyi_remain >= 1000) return;
    // switch off
    mode = 'real';
    clearInterval(flyi_interval);
    flyi_switch(false);
}

function flyi_switch(on: boolean) {
    gebi('mapTitle_flying').style.display = on ? '' : 'none';
    gebi('mapTitle_player').style.display = on ? 'none' : '';
    gebi('fpTitle_normal').style.display = on ? 'none' : '';
    gebi('fpTitle_flyi').style.display = on ? '' : 'none';
    gebi('myFlightplan').style.display = on ? 'none' : '';
    gebi('fp_hint').style.display = on ? 'none' : '';
    gebi('fp_flyi').style.display = on ? '' : 'none';
}

function start_game(universe) {
    gebi('main').style.display = 'flex';
    loadUniverse(universe);
    if (!check())
        alert('universe error, check console');
    set_shown_star(player_star);
    redraw();
}

var save_game = function () {
    console.log('simple mode save_game');
    localStorage['space2d2' + mode] = JSON.stringify(saveUniverse());
};

export function jump() {
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
    save_game();
    redraw();
    if (!check()) alert('universe error, check console');
    if (mode != 'real') return;
    // for REAL mode
    mode = 'flyi';
    flyi_finish = new Date().getTime() + flyi_time;
    flyi_switch(true);
    flyi_step();
    flyi_interval = setInterval(flyi_step, 1000);
}

window.onhashchange();

window.jump = jump;
window.redraw = redraw;
window.flightplan = flightplan;
window.redrawFlightplan = redrawFlightplan;
window.set_shown_star = set_shown_star;
window.get_shown_star = () => shown_star;
window.player_star = player_star;
window.get_player_star = () => player_star;
window.save_game = save_game;


if (location.hostname == 'localhost') {
    new EventSource('/esbuild').addEventListener('change', () => location.reload());
}
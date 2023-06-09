import { default as PocketBase, RecordAuthResponse } from "../pocketbase/pocketbase.es.mjs";
import { calc_sizes, cell_size, draw_portal, draw_star, portal_pad, portal_size } from "./draw.js";
import { flightplan, redrawFlightplan } from "./flightplan.js";
import { setupHints, set_shown_star, shown_star } from "./hints.js";
import { check, default_universe, loadUniverse, moveToNewStar, player_star, SaveData, saveUniverse, set_player_star, stats } from "./universe.js";

import textFit from '../textFit/textFit.js';
import { Direction } from "./angle.js";
import { Star } from "./stars.js";
import { sleep } from "./utils.js";

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
    flyi_time = 1000 * 10; //10sec
} else {
    flyi_time = 1000 * 60 * 60 * 10; //10h
}
export function redraw() {
    draw_star(ctx, shown_star);
    setupHints(shown_star, c, gebi('hints'));
    redrawFlightplan();
    gebi('mapTitle_player').style.display = (shown_star == player_star) ? '' : 'none';
    gebi('mapTitle_neighbour').style.display = (shown_star == player_star) ? 'none' : '';
    gebi('player_here').style.display = (shown_star == player_star) ? '' : 'none';
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
    document.title = `space2d2 - ${mode} mode`;

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
    } else {
        clearInterval(flyi_interval);
    }
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

var navigate_star: Star;

export async function navigateTo(dest: Direction | Star, reverse?: boolean, fade?: boolean) {
    //if reverse is not set - dest is one of shown_star.neighbours
    //if reverse is true - dest is ignored and considered a shown_star
    // return new Promise((resolve, reject) => {
    if (reverse) {
        dest = player_star.neighbours.directionOf(shown_star);
        set_shown_star(player_star);
        redraw();
    } else if (dest instanceof Star) {
        dest = shown_star.neighbours.directionOf(dest);
    }
    if (!dest.target) return; //reject('no dest.target');
    navigate_star = dest.target;

    const ring = gebi('navigate_ring') as HTMLCanvasElement;
    // if (ring.style.display != 'none') return;
    const ring_size = (portal_size * 2 + 4);
    ring.width = ring_size;
    ring.height = ring_size;
    // (ring.getContext("2d") as CanvasRenderingContext2D).drawImage(c, -ring_x + 2, -ring_y + 2);
    // draw a (fake) portal on fake_canvas and copy it to ring canvas
    const fake_direction = new Direction(90 + 45, shown_star, new Star());
    const fake_canvas = document.createElement('canvas') as HTMLCanvasElement;
    fake_canvas.width = fake_canvas.height = (fake_direction.x + portal_pad) * cell_size * 2;
    draw_portal(fake_canvas.getContext("2d") as CanvasRenderingContext2D, fake_direction);
    const fake_x = (fake_direction.x + portal_pad) * cell_size - ring_size / 2 + 2;
    const fake_y = (fake_direction.y + portal_pad) * cell_size - ring_size / 2 + 2;
    (ring.getContext("2d") as CanvasRenderingContext2D).drawImage(fake_canvas, -fake_x + 2, -fake_y + 2);
    const ring_x = (dest.x + portal_pad) * cell_size - ring_size / 2 + 2;
    const ring_y = (dest.y + portal_pad) * cell_size - ring_size / 2 + 2;
    const star = gebi('navigate_star') as HTMLCanvasElement;
    const star_size = (portal_size * 2);
    const star_x = (dest.x + portal_pad) * cell_size - star_size / 2 + 2;
    const star_y = (dest.y + portal_pad) * cell_size - star_size / 2 + 2;
    const star_ctx = star.getContext("2d") as CanvasRenderingContext2D;
    draw_star(star_ctx, navigate_star);
    calc_sizes(ctx, shown_star);
    ring.style.display = '';
    star.style.display = '';
    ring.style.transitionDuration = star.style.transitionDuration = '0s';
    if (!reverse) {
        ring.style.left = ring_x + 'px';
        ring.style.top = ring_y + 'px';
        ring.style.width = ring.style.height = ring_size + 'px';
        star.style.left = star_x + 'px';
        star.style.top = star_y + 'px';
        star.style.width = star.style.height = star_size + 'px';
        await sleep(10);//start animation
        // setTimeout(() => {
        var pad = fade ? 110 : 150;
        var ani_time = 300;
        ring.style.left = ring.style.top = `-${pad}px`;
        ring.style.width = ring.style.height = `${2 * pad + 500}px`;
        star.style.left = star.style.top = '2px';
        star.style.width = star.style.height = '500px';
        ring.style.transitionTimingFunction = star.style.transitionTimingFunction = 'ease-out';
        ring.style.transitionDuration = star.style.transitionDuration = ani_time + 'ms';
        // }, 0);
        await sleep(ani_time + 10);
        // setTimeout(() => {
        // const ring = gebi('navigate_ring') as HTMLCanvasElement;
        var pad = 500;
        var ani_time = fade ? 5000 : 50;
        ring.style.transitionDuration = ani_time + 'ms';
        ring.style.left = ring.style.top = `-${pad}px`;
        ring.style.width = ring.style.height = `${2 * pad + 500}px`;
        ring.style.transitionTimingFunction = 'linear';
        set_shown_star(navigate_star);
        redraw();
        star.style.display = 'none';
        // }, 500);
        // setTimeout(resolve, 600);
        if (fade) {
            setTimeout(() => { ring.style.display = 'none'; }, ani_time + 10);
        } else {
            await sleep(ani_time + 10);
            ring.style.display = 'none';
        }
    } else {
        var pad = 150;
        var ani_time = 400;
        ring.style.left = ring.style.top = `-${pad}px`;
        ring.style.width = ring.style.height = `${2 * pad + 500}px`;
        ring.style.transitionTimingFunction = star.style.transitionTimingFunction = 'ease-out';
        star.style.left = star.style.top = '2px';
        star.style.width = star.style.height = '500px';
        await sleep(10);
        // setTimeout(() => {
        ring.style.left = ring_x + 'px';
        ring.style.top = ring_y + 'px';
        ring.style.width = ring.style.height = ring_size + 'px';
        star.style.left = star_x + 'px';
        star.style.top = star_y + 'px';
        star.style.width = star.style.height = star_size + 'px';
        ring.style.transitionDuration = star.style.transitionDuration = ani_time + 'ms';
        // }, 0);
        // setTimeout(resolve, 500);
        await sleep(ani_time + 10);
        star.style.display = 'none';
        ring.style.display = 'none';
    }
};

async function jump() {
    if (shown_star == player_star) return;
    if (shown_star.visited) return;
    stats.s++;
    stats.p += flightplan.steps.length - 1;
    stats.jf += flightplan.countJobs();
    stats.js += player_star.jobs;
    // console.clear();
    const target_star = shown_star;
    // draw old player star before moveToNewStar turns some portals disabled
    flightplan.exitPortal = player_star.neighbours.directionOf(target_star);
    await navigateTo(player_star, true);
    gebi('player_travel').style.display = '';
    gebi('player_travel_css').innerHTML = `@keyframes player_travel {${flightplan.toKeyFrames()}}`;
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
    gebi('player_here').style.display = 'none';
    await sleep(1310);
    gebi('player_travel').style.display = 'none';

    await navigateTo(player_star, false, mode == 'real' && stats.s > 1);
    if (mode != 'real') return;
    // for REAL mode
    if (stats.s == 1) {
        return (gebi('real_nosave') as HTMLDialogElement).showModal();
    }
    flyi_switch(true);
}

window.onhashchange();

window.jump = jump;
window.redraw = redraw;
window.flightplan = flightplan;
window.redrawFlightplan = redrawFlightplan;
window.set_shown_star = set_shown_star;
window.get_shown_star = () => shown_star;
window.get_player_star = () => player_star;
window.navigateTo = navigateTo;


if (location.hostname == 'localhost') {
    new EventSource('/esbuild').addEventListener('change', () => location.reload());
}
var _ = require('lodash');
var fs = require('fs');
var mkdirp = require('mkdirp');
var defaultConfig = require('./config.defaults');
var argv = require('./arguments').argv;
var path = require('path');
var osHomedir = require('os-homedir');
var logger = require('winston');

var warnDeprecated = function(oldOpt, newOpt) {
    logger.warn('detected usage of deprecated config option "' + oldOpt + '", ' +
                 'support for it will be dropped in a future version! Consider ' +
                 'migrating to the new "' + newOpt + '" option instead.');
};

var deprecatedChannelOptions = {
    'irc_channel_id': 'ircChan',
    'irc_channel_pwd': 'chanPwd',
    'irc_channel': 'chanAlias',
    'tg_chat': 'tgGroup'
};

var deprecatedOptions = {
    'tg_bot_token': 'tgToken',
    'irc_nick': 'ircNick',
    'irc_server': 'ircServer',
    'irc_options': 'ircOptions',
    'irc_relay_all': 'ircRelayAll',
    'irc_hilight_re': 'hlRegexp',
    'send_topic': 'sendTopic',
    'mediaRandomLenght': 'mediaRandomLength'
};

// support old config options for a few versions, but warn about their usage
var parseDeprecatedOptions = function(config) {

    // search for old channel config options, loop through every channel
    _.forEach(config.channels, function(channel, i) {
        // loop over every key, value pair in the channel config
        _.forEach(channel, function(value, option) {
            var newOption = deprecatedChannelOptions[option];

            if (newOption) {
                channel[newOption] = value;
                delete(channel[option]);
                warnDeprecated(option, newOption);
            }
        });
    });

    // search for old config options by looping over every key, value pair
    _.forEach(config, function(value, option) {
        var newOption = deprecatedOptions[option];

        if (newOption) {
            config[newOption] = value;
            delete(config[option]);
            warnDeprecated(option, newOption);
        }
    });

    return config;
};

var config;
var configPath = argv.c || path.join(osHomedir(), '.teleirc', 'config.js');
if (argv.g) {
    mkdirp(path.join(osHomedir(), '/.teleirc'));

    // read default config using readFile to include comments
    var config = fs.readFileSync(path.join(__dirname, 'config.defaults.js'));
    fs.writeFileSync(configPath, config);
    console.log('Wrote default configuration to ' + configPath +
                ', please edit it before re-running');
    process.exit(0);
} else if (argv.j) {
    require('./join-tg');
    process.exit(0);
}

try {
    logger.info('using config file from: ' + configPath);
    config = require(configPath);
} catch (e) {
    logger.error('ERROR while reading config:\n' + e + '\n\nPlease make sure ' +
                  'it exists and is valid. Run "teleirc --genconfig" to ' +
                  'generate a default config.');
    process.exit(1);
}

if (argv['upgrade-config']) {
    logger.info('replacing deprecated config options...');

    var configFile = fs.readFileSync(configPath).toString();

    _.forEach(deprecatedChannelOptions, function(newOpt, depOpt) {
        configFile = configFile.replace(new RegExp(depOpt, 'g'), newOpt);
    });
    _.forEach(deprecatedOptions, function(newOpt, depOpt) {
        configFile = configFile.replace(new RegExp(depOpt, 'g'), newOpt);
    });

    config = parseDeprecatedOptions(config);
    logger.info('appending new config options...');

    // find out which options are missing
    var newOpts = _.difference(_.keys(defaultConfig), _.keys(config));

    // append each option to the end of the config file
    // NOTE: only works if config file uses the default syntax
    var commentAdded = false;
    _.forEach(newOpts, function(option) {
        if (!commentAdded) {
            configFile += '\n// automatically added by config upgrade:\n';
            commentAdded = true;
        }

        configFile += 'config.' + option + ' = ' + JSON.stringify(defaultConfig[option]) + ';\n';
    });

    fs.writeFileSync(configPath + '.new', configFile);

    logger.info('wrote new config to: ' + configPath + '.new, please review it before using');

    process.exit(0);
} else {
    config = parseDeprecatedOptions(config);
    config = _.defaults(config, defaultConfig);
}

if (argv.v) {
    // TODO: right now this is our only verbose option
    config.ircOptions.debug = true;
}

module.exports = config;
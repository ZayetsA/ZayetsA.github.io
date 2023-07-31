class BackgroundScene extends Phaser.Scene {
    gameScene;
    layer;

    constructor() {
        super('BackgroundScene');
    }

    preload() {
        this.load.image('bg', 'resources/assets/bg.jpg');
        this.load.image('fg', 'resources/assets/bigsky.png');
        this.load.image('ground', 'resources/assets/platform.png');
        this.load.image('coin', 'resources/assets/coin.png');
        this.load.image('bomb', 'resources/assets/tnt.png');
        this.load.spritesheet('dude', 'resources/assets/dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create() {
        this.add.image(0, 0, 'bg').setOrigin(0, 0);
        this.scene.launch('GameScene');
        this.gameScene = this.scene.get('GameScene');
    }

    updateCamera() {
        const width = this.scale.gameSize.width;
        const height = this.scale.gameSize.height;
        const camera = this.cameras.main;
        camera.centerOn(width / 2, (height / 2));
    }
}

//  This Scene is aspect ratio locked at 540 x 960 (and scaled and centered accordingly)
class GameScene extends Phaser.Scene {
    GAME_WIDTH = SIZE_WIDTH_SCREEN;
    GAME_HEIGHT = SIZE_HEIGHT_SCREEN;

    backgroundScene;
    parent;
    sizer;
    player;
    coins;
    bombs;
    platforms;
    cursors;
    score = 0;
    gameOver = false;
    scoreText;
    gameOverText;
    isClicking = false;
    swipeDirection;

    constructor() {
        super('GameScene');
    }

    create() {
        const width = this.scale.gameSize.width;
        const height = this.scale.gameSize.height;

        this.input.addPointer(2);

        this.add.image(0, 0, 'fg').setOrigin(0, 0);

        this.parent = new Phaser.Structs.Size(width, height);
        this.sizer = new Phaser.Structs.Size(this.GAME_WIDTH, this.GAME_HEIGHT, Phaser.Structs.Size.FIT, this.parent);

        this.parent.setSize(width, height);
        this.sizer.setSize(width, height);

        this.backgroundScene = this.scene.get('BackgroundScene');

        this.updateCamera();

        this.scale.on('resize', this.resize, this);

        //  -----------------------------------
        //  -----------------------------------
        //  -----------------------------------
        //  Normal game stuff from here on down
        //  -----------------------------------
        //  -----------------------------------
        //  -----------------------------------

        this.physics.world.setBounds(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        //  The platforms group contains the ground and the 2 ledges we can jump on
        this.platforms = this.physics.add.staticGroup();

        //  Here we create the ground.
        //  Scale it to fit the width of the game (the original sprite is 400x32 in size)
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.platforms.create(320, 944, 'ground').setScale(devicePixelRatio).refreshBody();

        // The player and its settings
        this.player = this.physics.add.sprite(100, 800, 'dude').setScale(1.5);

        //  Player physics properties. Give the little guy a slight bounce.
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);

        //  Our player animations, turning, walking left and walking right.
        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'turn',
            frames: [{ key: 'dude', frame: 4 }],
            frameRate: 20
        });

        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });

        //  Input Events
        this.cursors = this.input.keyboard.createCursorKeys();

        // Create the initial coins
        this.coins = this.physics.add.group();

        // Create the initial bombs
        this.bombs = this.physics.add.group();

        let bombFailureChance = 0.0; // Initial 5% chance of a failing bomb

        const spawnObjects = () => {
            const remainingObjects = 10 - (this.coins.countActive(true) + this.bombs.countActive(true));
            const objectsToSpawn = Phaser.Math.Between(1, Math.min(3, remainingObjects));

            for (let i = 0; i < objectsToSpawn; i++) {
                const randomValue = Math.random(); // Generate a random value between 0 and 1

                // Chance to spawn a bomb, including failure chance
                if (randomValue <= bombFailureChance) {
                    // Create a bomb
                    const x = Phaser.Math.Between(0, this.physics.world.bounds.width);
                    const y = Phaser.Math.Between(-200, -50); // Random y-coordinate above the top of the screen
                    const bomb = this.bombs.create(x, y, 'bomb');
                    bomb.setBounce(1, Phaser.Math.FloatBetween(0.4, 0.8));
                    bomb.setCollideWorldBounds(true);
                    const fallingSpeed = Phaser.Math.Between(150, 300);
                    bomb.setVelocity(Phaser.Math.Between(-200, 200), fallingSpeed);
                    const dragValue = Phaser.Math.Between(2, 6);
                    bomb.setDragX(dragValue);
                } else {
                    // Create a coin
                    const x = Phaser.Math.Between(0, this.physics.world.bounds.width);
                    const y = Phaser.Math.Between(-200, -50); // Random y-coordinate above the top of the screen
                    const coin = this.coins.create(x, y, 'coin');
                    coin.setBounce(1, Phaser.Math.FloatBetween(0.4, 0.8));
                    coin.setCollideWorldBounds(true);
                    const fallingSpeed = Phaser.Math.Between(150, 300);
                    coin.setVelocity(Phaser.Math.Between(-200, 200), fallingSpeed);
                    const dragValue = Phaser.Math.Between(2, 6);
                    coin.setDragX(dragValue);
                }
            }

            // Set the timer for the next spawn
            const nextSpawnDelay = Phaser.Math.Between(500, 2000); // Random delay between 0.5 and 2 seconds
            this.time.addEvent({
                delay: nextSpawnDelay,
                callback: spawnObjects,
                callbackScope: this
            });
        };

        // Increase the bomb failure chance every 10 seconds
        const increaseBombFailureChance = () => {
            bombFailureChance += 0.02;
            if (bombFailureChance > 1) {
                bombFailureChance = 1; // Cap the failure chance at 100%
            }

            // Set the timer for the next increase
            this.time.addEvent({
                delay: 10000, // 20 seconds
                callback: increaseBombFailureChance,
                callbackScope: this
            });
        };

        // Start the spawning process and increase the bomb failure chance
        spawnObjects();
        increaseBombFailureChance();

        //  The score
        this.scoreText = this.add.text(32, 8, 'score: 0', { fontSize: '32px', fill: '#ffffff' });

        this.gameOverText = this.add.text(this.sys.game.config.width / 2, this.sys.game.config.height / 2, '', {
            fontSize: '48px',
            fill: '#ff0000',
            align: 'center'
        });

        this.gameOverText.setOrigin(0.5);
        this.gameOverText.setVisible(false);

        //  Collide the player and the coins with the platforms
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.coins, this.platforms, this.destroyCoin, null, this);
        this.physics.add.collider(this.bombs, this.platforms, this.destroyBomb, null, this);

        //  Checks to see if the player overlaps with any of the coins, if he does call the collectCoin function
        this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);

        this.physics.add.collider(this.player, this.bombs, this.hitBomb, null, this);
    }

    //  ------------------------
    //  ------------------------
    //  ------------------------
    //  Resize related functions
    //  ------------------------
    //  ------------------------
    //  ------------------------

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.parent.setSize(width, height);
        this.sizer.setSize(width, height);

        this.updateCamera();
    }

    updateCamera() {
        const camera = this.cameras.main;

        const x = Math.ceil((this.parent.width - this.sizer.width) * 0.5);
        const verticalOffset = Math.ceil((this.parent.height - this.sizer.height) * 0.5);

        const y = verticalOffset;
        const scaleX = this.sizer.width / this.GAME_WIDTH;
        const scaleY = this.sizer.height / this.GAME_HEIGHT;

        camera.setViewport(x, y, this.sizer.width, this.sizer.height);
        camera.setZoom(Math.max(scaleX, scaleY));
        camera.centerOn(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2);

        this.backgroundScene.updateCamera();
    }

    getZoom() {
        return this.cameras.main.zoom;
    }

    //  ------------------------
    //  ------------------------
    //  ------------------------
    //  Game related functions
    //  ------------------------
    //  ------------------------
    //  ------------------------

    update() {
        if (this.gameOver) {
            return;
        }
        this.registerKeyboardControls()
        this.registerOnTouchControl()
    }

    registerKeyboardControls() {
        const cursors = this.cursors;
        const player = this.player;
        const pointer = this.input.pointer1;

        if (pointer.isDown) {
            return;
        }

        if (cursors.left.isDown) {
            player.setVelocityX(-160);

            player.anims.play('left', true);
        }
        else if (cursors.right.isDown) {
            player.setVelocityX(160);

            player.anims.play('right', true);
        }
        else {
            player.setVelocityX(0);

            player.anims.play('turn');
        }

        if (cursors.up.isDown && player.body.touching.down) {
            player.setVelocityY(-200);
        }

        if (cursors.down.isDown && !player.body.touching.down) {
            player.setVelocityY(+200);
        }

    }

    registerOnTouchControl() {
        const cursors = this.cursors;
        const player = this.player;
        const pointer = this.input.pointer1;
        if (cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown) {
            return;
        }

        if (pointer.isDown) {
            const halfScreenWidth = this.scale.width / 2;

            // If touch is on the left half of the screen, move left
            if (pointer.x < halfScreenWidth) {
                player.setVelocityX(-200);
                player.anims.play('left', true);
            }
            // If touch is on the right half of the screen, move right
            else {
                player.setVelocityX(200);
                player.anims.play('right', true);
            }
        } else {
            player.setVelocityX(0);
            player.anims.play('turn');
        }
    }


    collectCoin(player, coin) {
        coin.disableBody(true, true);
        //  Add and update the score
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
    }

    hitBomb(player, bomb) {
        this.physics.pause();
        player.setTint(0xff0000);
        player.anims.play('turn');
        this.coins.clear(true, true);
        this.bombs.clear(true, true);
        this.gameOver = true;
        this.gameOverText.setText('Game Over\nScore: ' + this.score);
        this.gameOverText.setVisible(true)
        this.scoreText.setVisible(false)
        CatcherGameInterface.onGameLoose(this.score);
    }

    destroyCoin(coin, platform) {
        coin.disableBody(true, true)
    }

    destroyBomb(bomb, platform) {
        if (!bomb.getData('collided')) {
            // Mark the bomb as collided and increase the collision count
            bomb.setData('collided', true);
            bomb.setData('collisions', 1);
        } else {
            // Increment the collision count and remove the bomb after the second collision
            const collisions = bomb.getData('collisions') + 1;
            bomb.setData('collisions', collisions);
            if (collisions >= 3) {
                bomb.disableBody(true, true);
            }
        }
    }
}

// Aspect Ratio 16:9 - Portrait
const MAX_SIZE_WIDTH_SCREEN = 1920
const MAX_SIZE_HEIGHT_SCREEN = 1080
const MIN_SIZE_WIDTH_SCREEN = 270
const MIN_SIZE_HEIGHT_SCREEN = 480
const SIZE_WIDTH_SCREEN = 540
const SIZE_HEIGHT_SCREEN = 960

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game',
        width: SIZE_WIDTH_SCREEN,
        height: SIZE_HEIGHT_SCREEN,
        min: {
            width: MIN_SIZE_WIDTH_SCREEN,
            height: MIN_SIZE_HEIGHT_SCREEN
        },
        max: {
            width: MAX_SIZE_WIDTH_SCREEN,
            height: MAX_SIZE_HEIGHT_SCREEN
        }
    },
    dom: {
        createContainer: true
    },
    scene: [BackgroundScene, GameScene],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 150 },
            debug: false
        }
    }
}

const game = new Phaser.Game(config)

// Global

game.screenBaseSize = {
    maxWidth: MAX_SIZE_WIDTH_SCREEN,
    maxHeight: MAX_SIZE_HEIGHT_SCREEN,
    minWidth: MIN_SIZE_WIDTH_SCREEN,
    minHeight: MIN_SIZE_HEIGHT_SCREEN,
    width: SIZE_WIDTH_SCREEN,
    height: SIZE_HEIGHT_SCREEN
}
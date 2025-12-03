import os, pygame, sys, random, time, math
from pygame.locals import *

# Pygame 초기화
pygame.init()

# 화면 설정
SCREEN_WIDTH = 144 * 4
SCREEN_HEIGHT = 288 * 3
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
fighter_sizeW = 50
fighter_sizeH = 50

# 폰트 설정
font = pygame.font.Font(None, 30)
final_font = pygame.font.Font(None, 50)
gameover_font = pygame.font.Font(None, 80)

class GameObject:
    def __init__(self, x, y, image_path, size, colorkey=(0, 0, 0)):
        self.x = x
        self.y = y
        self.image = pygame.image.load(image_path).convert_alpha()
        self.image = pygame.transform.scale(self.image, size)
        self.image.set_colorkey(colorkey)

    def draw(self):
        screen.blit(self.image, (self.x, self.y))

class Boss(GameObject):
    def __init__(self):
        super().__init__(random.randint(0, SCREEN_WIDTH - 150), -200, "image/boss.png", (150, 150), (255, 255, 255))
        self.hp = 500
        self.atk = 500
        self.dy = 0.6

    def move(self):
        self.y += self.dy

    def off_screen(self):
        return self.y > SCREEN_HEIGHT

    def touching(self, badguy):
        super_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        badguy_rect = pygame.Rect(badguy.x, badguy.y, badguy.image.get_width(), badguy.image.get_height())
        return super_rect.colliderect(badguy_rect)

class Badguy(GameObject):
    def __init__(self):
        super().__init__(random.randint(0, SCREEN_WIDTH - 70), -100, "image/badguy.png", (70, 70), (255, 255, 255))
        d = (math.pi / 2) * random.random() - (math.pi / 4)
        speed = random.randint(2, 6)
        self.dx = math.sin(d) * speed
        self.dy = math.cos(d) * speed
        self.hp = 20
        self.atk = 50

    def move(self):
        if self.x < 0 or self.x > SCREEN_WIDTH - 70:
            self.dx *= -1
        self.x += self.dx
        self.dy += 0.1
        self.y += self.dy

    def off_screen(self):
        return self.y > SCREEN_HEIGHT

    def touching(self, missile):
        badguy_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        missile_rect = pygame.Rect(missile.x, missile.y, missile.image.get_width(), missile.image.get_height())
        return badguy_rect.colliderect(missile_rect)

class MoonAttack(GameObject):
    def __init__(self, x, y):
        super().__init__(x - 5, y, "image/moon.png", (30, 30), (255, 255, 255))
        self.dy = 15
        self.atk = 10

    def move(self):
        self.y -= self.dy

    def off_screen(self):
        return self.y < -30

    def touching(self, target):
        moon_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        target_rect = pygame.Rect(target.x, target.y, target.image.get_width(), target.image.get_height())
        return moon_rect.colliderect(target_rect)

class SuperAttack(GameObject):
    def __init__(self, x, y):
        super().__init__(x - 50, y, "image/super.png", (50, 50), (255, 255, 255))
        self.dy = 10
        self.atk = 300

    def move(self):
        self.y -= self.dy

    def off_screen(self):
        return self.y < -64

    def touching(self, badguy):
        super_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        badguy_rect = pygame.Rect(badguy.x, badguy.y, badguy.image.get_width(), badguy.image.get_height())
        return super_rect.colliderect(badguy_rect)

class Missile(GameObject):
    def __init__(self, x, y):
        super().__init__(x - 4, y, "image/missile.png", (10, 16), (255, 255, 255))
        self.atk = 10

    def move(self):
        self.y -= 5

    def off_screen(self):
        return self.y < -8

class Heal(GameObject):
    def __init__(self, fighter):
        super().__init__(fighter.x, fighter.y, "image/heal.png", (160, 160), (255, 255, 255))
        self.fighter = fighter
        self.active = False
        self.start_time = 0
        self.duration = 0.5

    def activate(self):
        if not self.active:
            self.active = True
            self.start_time = time.time()
            self.fighter.hp += 50

    def deactivate(self):
        self.active = False

    def draw(self):
        if self.active and time.time() - self.start_time < self.duration:
            screen.blit(self.image, (self.fighter.x - 50, self.fighter.y - 50))
        elif self.active:
            self.deactivate()

class TrackingSuperAttack(GameObject):
    def __init__(self, x, y, target):
        super().__init__(x, y, "image/missile2.png", (50, 50), (0, 0, 0))
        self.dy = 10
        self.target = target
        self.speed = 7

    def move(self):
        if self.target:
            dx = self.target.x - self.x
            dy = self.target.y - self.y
            distance = math.sqrt(dx ** 2 + dy ** 2)
            if distance != 0:
                self.x += self.speed * dx / distance
                self.y += self.speed * dy / distance
        else:
            self.y -= self.dy

    def off_screen(self):
        return self.y < -64

    def touching(self, target):
        super_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        target_rect = pygame.Rect(target.x, target.y, target.image.get_width(), target.image.get_height())
        return super_rect.colliderect(target_rect)

class Fireball(GameObject):
    def __init__(self, fighter, offset_angle):
        radius = 60
        angle = math.radians(offset_angle)
        x = fighter.x + fighter.image.get_width() // 2 + int(radius * math.cos(angle)) - 15
        y = fighter.y + fighter.image.get_height() // 2 + int(radius * math.sin(angle)) - 15
        super().__init__(x, y, "image/fireball.png", (30, 30), (255, 255, 255))
        self.fighter = fighter
        self.offset_angle = offset_angle
        self.atk = 50

    def update_position(self):
        radius = 100
        angle = math.radians(self.offset_angle)
        self.x = self.fighter.x + self.fighter.image.get_width() // 2 + int(radius * math.cos(angle)) - 15
        self.y = self.fighter.y + self.fighter.image.get_height() // 2 + int(radius * math.sin(angle)) - 15

    def touching(self, target):
        fireball_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        target_rect = pygame.Rect(target.x, target.y, target.image.get_width(), target.image.get_height())
        return fireball_rect.colliderect(target_rect)

class Fighter(GameObject):
    def __init__(self):
        super().__init__(SCREEN_WIDTH // 2, SCREEN_HEIGHT - 50, "image/fighter.png", (fighter_sizeW, fighter_sizeH), (0, 0, 0))
        self.hp = 100
        self.atk = 10
        self.last_super_time = 0
        self.super_cooldown = 10
        self.last_moon_time = 0
        self.moon_cooldown = 18
        self.moon_active = False
        self.moon_start_time = 0
        self.shield = Shield(self)
        self.heal = Heal(self)
        self.last_tracking_super_time = 0
        self.tracking_super_cooldown = 8
        self.fireballs = []

    def touching(self, obj):
        fighter_rect = pygame.Rect(self.x, self.y, self.image.get_width(), self.image.get_height())
        obj_rect = pygame.Rect(obj.x, obj.y, obj.image.get_width(), obj.image.get_height())
        return fighter_rect.colliderect(obj_rect)

    def move(self, keys):
        if keys[K_LEFT] and self.x > 0:
            self.x -= 7
        if keys[K_RIGHT] and self.x < SCREEN_WIDTH - 100:
            self.x += 7
        if keys[K_UP] and self.y > 0:
            self.y -= 7
        if keys[K_DOWN] and self.y < SCREEN_HEIGHT - 100:
            self.y += 7

    def fire(self, missiles):
        missiles.append(Missile(self.x + (fighter_sizeW / 2), self.y))

    def can_use_super(self):
        return time.time() - self.last_super_time > self.super_cooldown

    def use_super(self, super_attacks):
        if self.can_use_super():
            super_attacks.append(SuperAttack(self.x + 50, self.y))
            self.last_super_time = time.time()

    def can_use_moon(self):
        return time.time() - self.last_moon_time > self.moon_cooldown

    def use_moon(self, moon_attacks):
        if self.can_use_moon():
            self.moon_active = True
            self.moon_start_time = time.time()
            self.last_moon_time = time.time()

        if self.moon_active:
            if time.time() - self.moon_start_time < 5:
                moon_attacks.append(MoonAttack(self.x + 15, self.y))
            else:
                self.moon_active = False

    def can_use_tracking_super(self):
        return time.time() - self.last_tracking_super_time > self.tracking_super_cooldown

    def use_tracking_super(self, tracking_super_attacks, badguys):
        if self.can_use_tracking_super() and badguys:
            closest_badguy = None
            closest_distance = float('inf')
            for badguy in badguys:
                distance = math.sqrt((badguy.x - self.x) ** 2 + (badguy.y - self.y) ** 2)
                if distance < closest_distance:
                    closest_distance = distance
                    closest_badguy = badguy

            if closest_badguy:
                tracking_super_attacks.append(TrackingSuperAttack(self.x + 50, self.y, closest_badguy))
                self.last_tracking_super_time = time.time()

    def update_fireballs(self):
        for fireball in self.fireballs:
            fireball.offset_angle += 2
            fireball.offset_angle %= 360
            fireball.update_position()

    def draw_fireballs(self):
        for fireball in self.fireballs:
            fireball.draw()

class Shield(GameObject):
    def __init__(self, fighter):
        super().__init__(fighter.x, fighter.y, "image/shield.png", (70, 70), (0, 0, 0))
        self.fighter = fighter
        self.active = False
        self.last_activation_time = 0
        self.cooldown = 28
        self.image.set_alpha(80)

    def activate(self):
        if time.time() - self.last_activation_time > self.cooldown:
            self.active = True
            self.last_activation_time = time.time()

    def deactivate(self):
        self.active = False

    def draw(self):
        if self.active:
            screen.blit(self.image, (self.fighter.x - 10, self.fighter.y - 10))

class Game:
    def __init__(self):
        self.background = pygame.image.load("image/background.png").convert()
        self.background = pygame.transform.scale(self.background, (SCREEN_WIDTH, SCREEN_HEIGHT))
        self.fighter = Fighter()
        self.badguys = []
        self.missiles = []
        self.bosses = []
        self.super_attacks = []
        self.score = 0
        self.last_spawn_time = 0
        self.last_boss_time = time.time()
        self.game_over = False
        self.moon_attacks = []
        self.last_heal_score = 0
        self.moon_active_time = 0
        self.tracking_super_attacks = []
        self.bg_y = 0
        self.last_fireball_score = 0
        self.paused = False

    def reset(self):
        self.__init__()

    def run(self):
        clock = pygame.time.Clock()
        while True:
            clock.tick(60)
            self.handle_events()
            if not self.game_over and not self.paused:
                self.update()
            self.render()

    def handle_events(self):
        global pressed_keys
        for event in pygame.event.get():
            if event.type == QUIT:
                sys.exit()
            if event.type == KEYDOWN:
                if self.game_over and (event.key == K_RETURN or event.key == K_SPACE):
                    self.reset()
                elif event.key == K_q and not self.game_over:
                    self.fighter.use_super(self.super_attacks)
                elif event.key == K_w and not self.game_over:
                    self.fighter.use_moon(self.moon_attacks)
                elif event.key == K_e and not self.game_over:
                    self.fighter.shield.activate()
                elif event.key == K_r and not self.game_over and self.score >= 5000:
                    self.fighter.use_tracking_super(self.tracking_super_attacks, self.badguys)
                elif event.key == K_TAB:
                    self.paused = not self.paused
        pressed_keys = pygame.key.get_pressed()

    def update(self):
        if self.score >= self.last_heal_score + 2000:
            self.fighter.heal.activate()
            self.last_heal_score = self.score

        fireball_level = self.score // 8000
        num_fireballs = len(self.fighter.fireballs)
        if fireball_level > num_fireballs:
            for i in range(fireball_level - num_fireballs):
                offset_angle = i * (360 / fireball_level) if fireball_level > 0 else 0
                self.fighter.fireballs.append(Fireball(self.fighter, offset_angle))
        elif fireball_level < num_fireballs:
            self.fighter.fireballs = self.fighter.fireballs[:fireball_level]

        for moon_attack in self.moon_attacks[:]:
            moon_attack.move()
            if moon_attack.off_screen():
                self.moon_attacks.remove(moon_attack)

        for tracking_super_attack in self.tracking_super_attacks[:]:
            tracking_super_attack.move()
            if tracking_super_attack.off_screen():
                self.tracking_super_attacks.remove(tracking_super_attack)
            for badguy in self.badguys[:]:
                if tracking_super_attack.touching(badguy):
                    self.badguys.remove(badguy)
                    self.tracking_super_attacks.remove(tracking_super_attack)
                    self.score += 400
                    break
            for boss in self.bosses[:]:
                if tracking_super_attack.touching(boss):
                    self.bosses.remove(boss)
                    self.tracking_super_attacks.remove(tracking_super_attack)
                    self.score += 1000
                    break

        for moon_attack in self.moon_attacks[:]:
            for badguy in self.badguys[:]:
                if moon_attack.touching(badguy):
                    self.badguys.remove(badguy)
                    self.moon_attacks.remove(moon_attack)
                    self.score += 300
                    break

        for moon_attack in self.moon_attacks[:]:
            for boss in self.bosses[:]:
                if moon_attack.touching(boss):
                    boss.hp -= moon_attack.atk
                    self.moon_attacks.remove(moon_attack)
                    if boss.hp <= 0:
                        self.bosses.remove(boss)
                        self.score += 2000
                    break

        for super_attack in self.super_attacks[:]:
            for badguy in self.badguys[:]:
                if super_attack.touching(badguy):
                    self.badguys.remove(badguy)
                    self.super_attacks.remove(super_attack)
                    self.score += 200
                    break

        for super_attack in self.super_attacks[:]:
            for boss in self.bosses[:]:
                if super_attack.touching(boss):
                    boss.hp -= super_attack.atk
                    self.super_attacks.remove(super_attack)
                    if boss.hp <= 0:
                        self.bosses.remove(boss)
                        self.score += 1000
                    break

        for super_attack in self.super_attacks[:]:
            super_attack.move()
            if super_attack.off_screen():
                self.super_attacks.remove(super_attack)

        if time.time() - self.last_spawn_time > 0.5:
            self.badguys.append(Badguy())
            self.last_spawn_time = time.time()

        if time.time() - self.last_boss_time > 10:
            self.bosses.append(Boss())
            self.last_boss_time = time.time()

        self.fighter.move(pressed_keys)
        self.fighter.update_fireballs()

        for badguy in self.badguys[:]:
            badguy.move()
            if badguy.off_screen():
                self.badguys.remove(badguy)
            for fireball in self.fighter.fireballs:
                if fireball.touching(badguy):
                    self.badguys.remove(badguy)
                    self.score += 150
                    break

        for boss in self.bosses[:]:
            boss.move()
            if boss.off_screen():
                self.bosses.remove(boss)
            for fireball in self.fighter.fireballs:
                if fireball.touching(boss):
                    boss.hp -= fireball.atk
                    if boss.hp <= 0:
                        self.bosses.remove(boss)
                        self.score += 1000
                    break

        for missile in self.missiles[:]:
            missile.move()
            if missile.off_screen():
                self.missiles.remove(missile)

        for badguy in self.badguys[:]:
            for missile in self.missiles[:]:
                if badguy.touching(missile):
                    badguy.hp -= missile.atk
                    self.missiles.remove(missile)
                    if badguy.hp <= 0:
                        self.badguys.remove(badguy)
                        self.score += 100
                    break

        if not self.game_over and time.time() - getattr(self, 'last_missile_time', 0) > 0.15 and not self.fighter.moon_active:
            self.fighter.fire(self.missiles)
            self.last_missile_time = time.time()

        for boss in self.bosses[:]:
            for missile in self.missiles[:]:
                if boss.touching(missile):
                    boss.hp -= missile.atk
                    self.missiles.remove(missile)
                    if boss.hp <= 0:
                        self.bosses.remove(boss)
                        self.score += 500
                    break

        for badguy in self.badguys[:]:
            if self.fighter.touching(badguy):
                if self.fighter.shield.active:
                    self.fighter.shield.deactivate()
                    self.badguys.remove(badguy)
                else:
                    self.fighter.hp -= badguy.atk
                    self.badguys.remove(badguy)
                    if self.fighter.hp <= 0:
                        self.game_over = True

        for boss in self.bosses[:]:
            if self.fighter.touching(boss):
                self.fighter.hp -= boss.atk
                self.bosses.remove(boss)
                if self.fighter.hp <= 0:
                    self.game_over = True

        self.bg_y += 1
        if self.bg_y > SCREEN_HEIGHT:
            self.bg_y = 0

    def render(self):
        screen.blit(self.background, (0, self.bg_y))
        screen.blit(self.background, (0, self.bg_y - SCREEN_HEIGHT))

        if not self.game_over:
            self.fighter.draw()
            self.fighter.shield.draw()
            self.fighter.heal.draw()
            self.fighter.draw_fireballs()
            for badguy in self.badguys:
                badguy.draw()
            for boss in self.bosses:
                boss.draw()
            for missile in self.missiles:
                missile.draw()
            for super_attack in self.super_attacks:
                super_attack.draw()
            for moon_attack in self.moon_attacks:
                moon_attack.draw()
            for tracking_super_attack in self.tracking_super_attacks:
                tracking_super_attack.draw()

            score_text = font.render(f"Score: {self.score}", True, (255, 255, 255))
            screen.blit(score_text, (5, 5))
            hp_text = font.render(f"HP: {self.fighter.hp}", True, (255, 255, 255))
            screen.blit(hp_text, (5, 25))

        if self.game_over:
            gameover_text = gameover_font.render("Game Over", True, (255, 0, 0))
            gameover_rect = gameover_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 50))
            screen.blit(gameover_text, gameover_rect)

            final_score_text = final_font.render(f"Final Score: {self.score}", True, (255, 255, 255))
            final_score_rect = final_score_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 50))
            screen.blit(final_score_text, final_score_rect)

            restart_text = font.render("Press Enter or Space to restart", True, (255, 255, 255))
            restart_rect = restart_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 100))
            screen.blit(restart_text, restart_rect)

        pygame.display.update()

# 게임 실행 시작
if __name__ == "__main__":
    Game().run()

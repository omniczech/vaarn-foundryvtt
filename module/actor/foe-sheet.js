/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class KnaveFoeSheet extends ActorSheet {
  #_hitTargets = new Set();

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["knave", "sheet", "actor"],
      template: "systems/vaultsofvaarn/templates/actor/foe-sheet.html",
      width: 1000,
      height: 620,
      tabs: [
        {
          navSelector: ".description-tabs",
          contentSelector: ".description-tabs-content",
          initial: "description",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /** @override */

  getData() {
    let sheet = super.getData();
    return sheet;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    html.find(".item-create").click(this._onItemCreate.bind(this));

    //ability button clicked
    html.find(".knave-ability-button").click((ev) => {
      this._onAbility_Clicked($(ev.currentTarget)[0].id);
    });
    html.find(".knave-morale-button").click(this._onMoraleCheck.bind(this));
    html.find(".knave-armor-button").click(this._onArmorCheck.bind(this));
    html.find(".knave-short-rest-button").click(this._shortRest.bind(this));
    html.find(".knave-long-rest-button").click(this._longRest.bind(this));
    html.find(".knave-wounded-button").click(this._wounded.bind(this));

    // Update Inventory Item
    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find(".item-delete").click((ev) => {
      const button = ev.currentTarget;
      const li = button.closest(".item");
      const item = this.actor.items.get(li?.dataset.itemId);
      return item.delete();
    });

    //inventory weapon rolls
    html.find(".item-roll").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      this._onItemRoll(item, ev.currentTarget);
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    const cls = getDocumentClass("Item");
    return cls.create(itemData, { parent: this.actor });
  }

  _onAbility_Clicked(ability, additional = null) {
    let score = 0;
    let name = "";
    switch (ability) {
      case "str":
        score = this.object.system.hd.value;
        if (additional) {
          name = additional;
        } else {
          name = "STR";
        }
        break;
      case "dex":
        score = this.object.system.hd.value;
        if (additional) {
          name = additional;
        } else {
          name = "DEX";
        }
        break;
      case "con":
        score = this.object.system.abilities.con.value;
        name = "CON";
        break;
      case "int":
        score = this.object.system.abilities.int.value;
        name = "INT";
        break;
      case "psy":
        score = this.object.system.abilities.psy.value;
        name = "PSY";
        break;
      case "ego":
        score = this.object.system.abilities.ego.value;
        name = "EGO";
        break;
    }

    let formula = `2d10+${score}`;
    let r = new Roll(formula);
    r.evaluate({ async: false });

    let returnCode = 0;
    let messageHeader = "<b>" + name + "</b>";
    if (r.dice[0].total <= 3)
      messageHeader +=
        ' - <span class="knave-ability-crit knave-ability-critFailure">CRITICAL FAILURE!</span>';
    else if (r.dice[0].total >= 19)
      messageHeader +=
        ' - <span class="knave-ability-crit knave-ability-critSuccess">CRITICAL SUCCESS!</span>';

    r.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: messageHeader,
    });
    return r;
  }

  _onMoraleCheck(event) {
    event.preventDefault();

    let r = new Roll(`1d20+${this.object.system.morale.value}`);
    r.evaluate({ async: false });
    let messageHeader = "";
    if (r._total < 15)
      messageHeader +=
        '<span class="knave-ability-crit knave-ability-critFailure">Is fleeing</span>';
    else
      messageHeader +=
        '<span class="knave-ability-crit knave-ability-critSuccess">Is staying</span>';
    r.toMessage({ flavor: messageHeader });
  }

  _onArmorCheck(event) {
    let name = "ARMOR";
    let score = this.object.system.armor.bonus;
    event.preventDefault();

    let formula = `1d20+${score}`;
    let r = new Roll(formula);
    r.evaluate({ async: false });

    let returnCode = 0;
    let messageHeader = "<b>" + name + "</b>";
    if (r.dice[0].total === 1)
      messageHeader +=
        ' - <span class="knave-ability-crit knave-ability-critFailure">CRITICAL FAILURE!</span>';
    else if (r.dice[0].total === 20)
      messageHeader +=
        ' - <span class="knave-ability-crit knave-ability-critSuccess">CRITICAL SUCCESS!</span>';

    r.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: messageHeader,
    });
    return r;
  }

  _onItemRoll(item, eventTarget) {
    if (eventTarget.title === "attack") {
      if (item.type === "weaponMelee") {
        const roll = this._onAbility_Clicked(
          "str",
          `Melee Attack (${item.name})`
        );

        this._checkToHitTargets(roll, item);
      } else if (item.type === "weaponRanged") {
        this._rangedAttackRoll(item);
      }
    } else if (eventTarget.title === "damage") {
      let r = new Roll(item.system.damageDice);
      r.evaluate({ async: false });
      let messageHeader = "<b>" + item.name + "</b> damage";
      r.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: messageHeader,
      });

      this.#_hitTargets.forEach((target) => {
        this._doDamage(target, r.total);
      });
    }
  }

  _rangedAttackRoll(item) {
    const roll = this._onAbility_Clicked("dex", `Ranged Attack (${item.name})`);

    this._checkToHitTargets(roll, item);
  }

  _createNoAmmoMsg(item, outOfAmmo) {
    let content = "<b>" + item.name + "</b> ";
    if (outOfAmmo === true) {
      content += "is out of ammo!";
    } else {
      content += "has no ammo!";
    }

    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: content,
    });
  }

  _checkToHitTargets(roll, item) {
    this.#_hitTargets.clear();
    game.users.current.targets.forEach((x) => {
      if (roll.total > x.actor.system.armor.value) {
        this._createHitMsg(x.actor, false, item);
        this.#_hitTargets.add(x);
      } else this._createHitMsg(x.actor, true, item);
    });
  }

  _createHitMsg(targetActor, missed, item) {
    const hitMsg = "<b>hit</b> " + targetActor.name + " with " + item.name;
    const missMsg = "<b>missed</b> " + targetActor.name + " with " + item.name;

    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: missed ? missMsg : hitMsg,
    });
  }

  _doDamage(token, dmg) {
    const currentHP = token.actor.system.health.value;
    let newHP = currentHP - dmg;
    if (currentHP > 0 && newHP <= 0) {
      newHP = 0;
      const msg = "is unconscious";
      ChatMessage.create({
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({ actor: token.actor }),
        content: msg,
      });
    } else if (currentHP === 0) {
      const msg = "is killed";
      ChatMessage.create({
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({ actor: token.actor }),
        content: msg,
      });
    }

    token.actor.update({ "system.health.value": newHP });
  }
  _shortRest(event) {
    const conBonus = this.object.system.abilities.con.value;
    let formula = `1d8+${conBonus}`;
    let r = new Roll(formula);
    r.evaluate({ async: false });
    this.object.update({
      "system.health.value": r.total + this.object.system.health.value,
    });

    ChatMessage.create({
      user: game.user._id,
      // speaker: ChatMessage.getSpeaker({ actor: token.actor }),
      content: `${this.object.name} has taken a short rest and recovered ${r.total} health`,
    });

    // this.object.update({'system.health.value':this.object.data.data.system.health.value +this.object.})
    // this.object.update({'system.health.value':this.object.data.data.system.health.max})
  }
  _longRest(event) {
    const wounds = this.object.items._source.filter((x) => x.type === "wound");
    console.log(this.object);
    if (wounds.length < 1) {
      this.object.update({
        "system.health.value": this.object.system.health.max,
      });

      ChatMessage.create({
        user: game.user._id,
        // speaker: ChatMessage.getSpeaker({ actor: token.actor }),
        content: `${this.object.name} has taken a long rest and recovered to their max health`,
      });
    } else {
      var randomWound = wounds[Math.floor(Math.random() * wounds.length)];
      const { name, _id } = randomWound;
      var selectedWound = this.object.items.get(_id);
      selectedWound.delete();
      ChatMessage.create({
        user: game.user._id,
        // speaker: ChatMessage.getSpeaker({ actor: token.actor }),
        content: `${this.object.name} healed ${name} instead of healing hp`,
      });
    }
  }
  _wounded(event) {
    console.log(this.object, this, event, Items);
    const allWounds = game.items.filter((item) => item.type === "wound");
    console.log(allWounds);
    var randomWound = allWounds[Math.floor(Math.random() * allWounds.length)];
    console.log(allWounds, randomWound);

    const itemData = {
      name: randomWound.name,
      type: randomWound.type,
      data: randomWound.data,
      img: randomWound.img,
    };
    ChatMessage.create({
      user: game.user._id,
      // speaker: ChatMessage.getSpeaker({ actor: token.actor }),
      content: `${this.object.name} has acquired the following wound: ${randomWound.name}! They will have to take a long rest to heal this wound and recover`,
    });

    const cls = getDocumentClass("Item");
    return cls.create(randomWound, { parent: this.actor });
  }
}

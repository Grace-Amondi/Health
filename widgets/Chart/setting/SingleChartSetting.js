///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/_base/html',
  'dojo/_base/query',
  'dojo/_base/Color',
  'dojo/on',
  'dojo/Evented',
  'dojo/Deferred',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./SingleChartSetting.html',
  'dijit/TooltipDialog',
  'dijit/popup',
  'jimu/dijit/Popup',
  'jimu/utils',
  'jimu/dijit/TabContainer3',
  'jimu/dijit/Filter',  'jimu/dijit/_FeaturelayerSourcePopup',
  'jimu/dijit/Message',
  'jimu/dijit/StatisticsChart',
  'jimu/LayerInfos/LayerInfos',
  './DataFields',
  './Sort',
  './utils',
  'jimu/dijit/_StatisticsChartSettings',
  'esri/tasks/query',
  'esri/tasks/QueryTask',
  'esri/symbols/jsonUtils',
  'dijit/Tooltip',
  'dijit/form/Select',
  'dijit/form/ValidationTextBox',
  'jimu/dijit/SymbolPicker',
  'jimu/dijit/SimpleTable',
  'jimu/dijit/LoadingIndicator',
  'jimu/dijit/CheckBox'
],
function(declare, lang, array, html, query, Color, on, Evented, Deferred, _WidgetBase, _TemplatedMixin,
  _WidgetsInTemplateMixin, template, TooltipDialog, dojoPopup, jimuPopup, jimuUtils, TabContainer3, Filter,
  _FeaturelayerSourcePopup, Message, StatisticsChart, LayerInfos, DataFields, Sort, utils, StatisticsChartSettings,
  EsriQuery, QueryTask, esriSymbolJsonUtils) {

  return declare([_WidgetBase, Evented, _TemplatedMixin, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-singlechart-setting',
    templateString: template,
    mediaSelector: null,

    //options
    config: null,
    map: null,
    nls: null,
    tr: null,
    folderUrl: '',
    appConfig: null,
    _webMapLayerId: null,//the layerId in web map, maybe null

    //public methods:
    //setConfig
    //getConfig
    //setNewLayerDefinition

    maxPreviewFeaturesCount: 50,

    _layerDefinition: null,

    _highLightColor: '#ff0000',

    _oidFieldType: 'esriFieldTypeOID',

    _stringFieldType: 'esriFieldTypeString',

    _numberFieldTypes: ['esriFieldTypeSmallInteger',
                        'esriFieldTypeInteger',
                        'esriFieldTypeSingle',
                        'esriFieldTypeDouble'],

    _dateFieldType: 'esriFieldTypeDate',

    postCreate: function(){
      this.inherited(arguments);
      utils.layerInfosObj = LayerInfos.getInstanceSync();
      this._initSelf();
    },

    destroy: function(){
      this.tr = null;
      delete this.tr;
      //destroy TooltipDialog
      this._hideAllTooltipDialogs();
      this._destroyTooltipDialog('filterTooltipDialog');
      this._destroyTooltipDialog('sortOrderTooltipDialog');
      this._destroyTooltipDialog('columnTTD');
      this._destroyTooltipDialog('barTTD');
      this._destroyTooltipDialog('lineTTD');
      this._destroyTooltipDialog('pieTTD');

      if(this.filter){
        this.filter.destroy();
      }
      if (this.jimuPopup) {
        this.jimuPopup.onClose = lang.hitch(this, function() {
          return true;
        });
        this.jimuPopup.close();
      }
      this.inherited(arguments);
    },

    _destroyTooltipDialog: function(name){
      var ttd = this[name];
      if(ttd){
        this._hideTooltipDialog(ttd);
        ttd.destroy();
      }
      ttd = null;
      this[name] = null;
    },

    _hideAllTooltipDialogs: function(){
      this._hideTooltipDialog(this.filterTooltipDialog);
      this._hideTooltipDialog(this.sortOrderTooltipDialog);
      this._hideAllParamsTooltipDialogs();
    },

    _hideAllParamsTooltipDialogs: function(){
      if(this.columnTTD){
        this._hideTooltipDialog(this.columnTTD);
      }
      if(this.barTTD){
        this._hideTooltipDialog(this.barTTD);
      }
      if(this.lineTTD){
        this._hideTooltipDialog(this.lineTTD);
      }
      if(this.pieTTD){
        this._hideTooltipDialog(this.pieTTD);
      }
    },

    _hideTooltipDialog: function(tooltipDialog){
      if(tooltipDialog){
        dojoPopup.close(tooltipDialog);
        tooltipDialog.isOpendNow = false;
      }
    },

    _showTooltipDialog: function(tooltipDialog, around, /* optional */ orient){
      if(tooltipDialog){
        var args = {
          popup: tooltipDialog,
          around: around
        };
        if(orient){
          args.orient = orient;
        }
        dojoPopup.open(args);
        tooltipDialog.isOpendNow = true;
      }
    },

    startup: function(){
      if(!this._started){
        this.inherited(arguments);
        // setTimeout(lang.hitch(this, function(){
        //   this._updateUrlTextBoxLength();
        // }), 200);
      }
      this._started = true;
    },

    _updateUrlTextBoxLength: function(){
      try{
        var boxBtn = html.getMarginBox(this.btnSetSource);
        var boxDescription = html.getContentBox(this.descriptionTA);
        var width = Math.max(boxDescription.w - boxBtn.w - 10, 380);
        html.setStyle(this.urlTextBox.domNode, 'width', width + 'px');
      }
      catch(e){
        console.error(e);
      }
    },

    setConfig: function(config){
      if(!this._isObject(config)){
        return;
      }

      this.config = config;
      var url = config.url || '';
      var validUrl = url && typeof url === 'string';
      if(!validUrl){
        return;
      }
      var layerId = config.webMapLayerId;

      if (this._layerDefinition && this._layerDefinition.url === url) {
        this._resetByConfig(this.config, this._layerDefinition);
      } else {
        this._layerDefinition = null;
        this.showBigShelter();
        utils.getLayerDefinitionByLayerIdOrUrl(layerId, url).then(function(definition) {
          if (!this.domNode) {
            return;
          }
          this.hideBigShelter();
          this._layerDefinition = definition;
          this._layerDefinition.url = url;
          this._resetByConfig(this.config, this._layerDefinition);
        }.bind(this), function(err) {
          console.error(err);
          if (!this.domNode) {
            return;
          }
          this.hideBigShelter();
        }.bind(this));
      }
    },

    getConfig: function(showError){
      var config = {
        url: '',
        filter: '',
        description: '',
        symbol: '',
        webMapLayerId: this._webMapLayerId,

        mode:'',
        name: '',
        highLightColor: '',
        types: []//{type,display}
      };

      config.url = this.urlTextBox.get('value');

      var filter = this.filter.toJson();
      var expr = filter && filter.expr;
      if(!expr){
        if(showError){
          if(this.tab.viewStack.getSelectedLabel() !== this.nls.preview){
            this._showTooltipDialog(this.filterTooltipDialog, this.urlTextBox.domNode);
          }
          this._showMessage(this.nls.setFilterTip);
        }
        return false;
      }
      config.filter = filter;

      var chartName = this.chartNameTextBox.get('value');
      chartName = jimuUtils.stripHTML(chartName);
      if(!chartName){
        if(showError){
          this._showMessage(this.nls.setChartTitleTip);
        }
        return false;
      }
      config.name = chartName;

      config.description = jimuUtils.stripHTML(this.descriptionTA.value);

      config.mode = this.chartModeSelect.get('value');

      if(this.columnCbx.checked){
        config.types.push({
          type: 'column',
          display: this.columnParameters.getConfig()
        });
      }

      if(this.pieCbx.checked){
        config.types.push({
          type: 'pie',
          display: this.pieParameters.getConfig()
        });
      }

      if(this.barCbx.checked){
        config.types.push({
          type: 'bar',
          display: this.barParameters.getConfig()
        });
      }

      if(this.lineCbx.checked){
        config.types.push({
          type: 'line',
          display: this.lineParameters.getConfig()
        });
      }

      if(config.types.length === 0 && showError){
        this._showMessage(this.nls.setChartTypeTip);
        return false;
      }

      if(config.mode === 'feature'){
        var featureConfig = {
          labelField: '',
          valueFields: [],
          sortOrder: {}
        };

        featureConfig.labelField = this.featureAxisLabelSelect.get('value');

        var featureDataFields = this.valueFields.getSelectedFieldNames();
        if(featureDataFields.length === 0){
          if(showError){
            this._showMessage(this.nls.setDataFieldTip);
          }
          return false;
        }
        featureConfig.valueFields = featureDataFields;
        //sort order
        featureConfig.sortOrder = this._getSortOrder();

        config = lang.mixin(config, featureConfig);
      }else if(config.mode === 'category'){
        var categoryConfig = {
          categoryField: '',
          operation: '',
          valueFields: [],
          sortOrder: {}
        };

        categoryConfig.categoryField = this.categoryFieldSelect.get('value');//check if none

        categoryConfig.operation = this.categoryOperationSelect.get('value');

        var categoryDataFields = this.valueFields.getSelectedFieldNames();
        if(categoryDataFields.length === 0){
          if(showError){
            this._showMessage(this.nls.setDataFieldTip);
          }
          return false;
        }
        categoryConfig.valueFields = categoryDataFields;

        categoryConfig.sortOrder = this._getSortOrder();

        config = lang.mixin(config, categoryConfig);
      }else if(config.mode === 'count'){
        var countConfig = {
          categoryField: '',
          sortOrder: {}
        };

        countConfig.categoryField = this.categoryFieldSelect.get('value');

        countConfig.sortOrder = this._getSortOrder();

        config = lang.mixin(config, countConfig);
      }else if(config.mode === 'field'){
        var fieldConfig = {
          operation: '',
          valueFields: [],
          sortOrder: {}
        };

        fieldConfig.operation = this.fieldOperationSelect.get('value');

        var fieldDataFields = this.valueFields.getSelectedFieldNames();
        if(fieldDataFields.length === 0){
          if(showError){
            this._showMessage(this.nls.setDataFieldTip);
          }
          return false;
        }
        fieldConfig.valueFields = fieldDataFields;
        fieldConfig.sortOrder = this._getSortOrder();
        config = lang.mixin(config, fieldConfig);
      }

      this.config = lang.clone(config);

      var symbol = this.symbolPicker.getSymbol();
      if(symbol){
        config.symbol = symbol.toJson();
      }else{
        return false;
      }

      var color = this.colorPicker.getColor();
      config.highLightColor = color.toHex();

      this.tr._layerDefinition = this._layerDefinition;

      return lang.clone(config);
    },

    showBigShelter: function(){
      this.emit("show-shelter");
    },

    _getSortOrder:function(){
      return this.sortDijit.getConfig();
    },

    hideBigShelter: function(){
      this.emit("hide-shelter");
    },

    _showMessage: function(msg){
      new Message({
        message: msg
      });
    },

    _isObject:function(o){
      return o && typeof o === 'object';
    },

    _initSelf: function(){
      this._initCheckBox();
      this._initTabs();
      this._initChartTypes();
      this._initFilter();
      this._initSortOrder();
      this._initDataFields();
      this._initPreview();
      var mode = this.config && this.config.mode;
      this._updateUIByMode(mode);
    },

    _initCheckBox:function(){
      this.columnCbx.setLabel(this.nls.column);
      this.pieCbx.setLabel(this.nls.pie);
      this.barCbx.setLabel(this.nls.bar);
      this.lineCbx.setLabel(this.nls.line);
    },

    _initTabs: function(){
      var tabSettings = {
        title: this.nls.settings,
        content: this.settingsTabNode
      };

      var tabPreview = {
        title: this.nls.preview,
        content: this.previewTabNode
      };

      var tabs = [tabSettings, tabPreview];
      this.tab = new TabContainer3({tabs: tabs});
      this.tab.placeAt(this.tabDiv);
      this.own(on(this.tab, 'tabChanged', lang.hitch(this, function(title){
        this._hideAllTooltipDialogs();
        if(title === tabPreview.title){
          this._updatePreview();
        }
      })));
    },

    _initFilter: function(){
      var str = '<div>' +
        '<div class="filter-div"></div>' +
        '<div class="operations" style="overflow:hidden;">' +
          '<div class="jimu-btn  jimu-float-trailing btn-cancel"></div>' +
          '<div class="jimu-btn  jimu-float-trailing btn-ok"></div>' +
        '</div>' +
      '</div>';
      var ttdContent = html.toDom(str);
      var filterDiv = query('.filter-div', ttdContent)[0];
      var btnOk = query('.btn-ok', ttdContent)[0];
      var btnCancel = query('.btn-cancel', ttdContent)[0];
      btnOk.innerHTML = this.nls.ok;
      btnCancel.innerHTML = this.nls.close;

      if(window.isRTL){
        btnOk.style.marginLeft = "20px";
      }
      else{
        btnOk.style.marginRight = "20px";
      }

      this.jimuPopup = new jimuPopup({
        width: 700,
        content: ttdContent,
        hasTitle: false,
        enableMoveable: false,
        autoHeight: true,
        hiddenAfterInit: true,
        onClose: lang.hitch(this, function() {
          this._hideJimuPopup();
          return false;
        }),
        buttons: []
      });


      this.filter = new Filter({
        autoSwitchMode: false,
        runtime: true //no predefined options
      });
      this.filter.allExpsBox.style.maxHeight = "300px";
      this.filter.allExpsBox.style.overflowY = "auto";
      this.filter.placeAt(filterDiv);
      this.filter.startup();

      this.own(on(btnOk, 'click', lang.hitch(this, function(){
        var result = this.filter.toJson();
        if(result){
          this._hideJimuPopup();
        }else{
          this._showMessage(this.nls.setFilterTip);
        }
      })));

      this.own(on(btnCancel, 'click', lang.hitch(this, function(){
        //restore filter to previous config
        this._hideJimuPopup();
      })));

      this.own(on(this.filterIcon, 'click', lang.hitch(this, function(){
        if(this.jimuPopup){
          this.jimuPopup.show();
          this.jimuPopup.resize();
        }
      })));
    },

    _hideJimuPopup: function() { //not destroy it
      if (this.jimuPopup) {
        this.jimuPopup.hide();
      }
    },

    _initSortOrder: function() {
      this.sortDijit = new Sort({
        nls: this.nls
      });
      this.sortDijit.placeAt(this.SortDiv);
    },

    _initDataFields: function(){
      this.valueFields = new DataFields({
        nls: this.nls
      });
      this.valueFields.placeAt(this.dataFieldsDiv);
      this.valueFields.startup();
      this.own(on(this.valueFields, 'change', lang.hitch(this, function(){
        this._updateChartTypes();
        this._updateSortFields();
        this._updateParametersDijit();
      })));
    },

    _updateParametersDijit: function(){
      var mode = this.chartModeSelect.get('value');

      if(mode === 'feature' || mode === 'category'){
        var fields = this.valueFields.getSelectedFieldNames();
        if(fields.length === 1){
          //if one field selected, should show single color section
          this.columnParameters.showSingleColor();
          this.barParameters.showSingleColor();
          this.lineParameters.showSingleColor();
        }
        else{
          //if none or more than two fields selected, should show multiple color section
          this.columnParameters.showMultiColor();
          this.barParameters.showMultiColor();
          this.lineParameters.showMultiColor();
        }
      }
      else{
        //chart only supports single color for count and field mode
        this.columnParameters.showSingleColor();
        this.barParameters.showSingleColor();
        this.lineParameters.showSingleColor();
      }
      //legend
      this._updateChartModeOfChartParamters(mode);
    },

    _updateChartTypes: function(){
      this.pieCbx.setStatus(true);

      var chartMode = this.chartModeSelect.get('value');

      if(chartMode === 'feature' || chartMode === 'category'){
        var fields = this.valueFields.getSelectedFieldNames();
        if(fields.length > 1){
          this.pieCbx.setValue(false);
          this.pieCbx.setStatus(false);
        }
      }
    },

    _initChartTypes: function(){
      var imagesUrl = this.folderUrl + 'common/images';
      //column
      this.columnParameters = new StatisticsChartSettings({
        type: 'column',
        imagesUrl: imagesUrl,
        isInWidget: false,
        singleColor: false,
        nls: this.nls,
        config: null
      });
      this.columnTTD = this._createParametersDialog(this.columnCbx,
                                                    this.columnEdit,
                                                    this.columnParameters);

      //pie
      this.pieParameters = new StatisticsChartSettings({
        type: 'pie',
        imagesUrl: imagesUrl,
        isInWidget: false,
        singleColor: false,
        nls: this.nls,
        config: null
      });
      this.pieTTD = this._createParametersDialog(this.pieCbx, this.pieEdit, this.pieParameters);

      //bar
      this.barParameters = new StatisticsChartSettings({
        type: 'bar',
        imagesUrl: imagesUrl,
        isInWidget: false,
        singleColor: false,
        nls: this.nls,
        config: null
      });
      this.barTTD = this._createParametersDialog(this.barCbx, this.barEdit, this.barParameters);

      //line
      this.lineParameters = new StatisticsChartSettings({
        type: 'line',
        imagesUrl: imagesUrl,
        isInWidget: false,
        singleColor: false,
        nls: this.nls,
        config: null
      });
      this.lineTTD = this._createParametersDialog(this.lineCbx, this.lineEdit, this.lineParameters);

      this.own(on(document.body, 'click', lang.hitch(this, function(event){
        var target = event.target || event.srcElement;
        this._unselectEditDivs();
        var isOpendNow = null;
        var checkNode = null, checkbox = null;
        var editDiv = null;
        var tooltipDialog = null;
        if(html.hasClass(target, 'checkbox')){
          checkNode = target;
        }else if(html.hasClass(target, 'label')){
          var preNode = target.previousElementSibling;
          if(html.hasClass(preNode, 'checkbox')){
            checkNode = preNode;
          }
        }
        var isCheckBox = (checkNode === this.columnCbx.checkNode) ||
                         (checkNode === this.pieCbx.checkNode) ||
                         (checkNode === this.barCbx.checkNode) ||
                         (checkNode === this.lineCbx.checkNode);
        var isEditDiv = (target === this.columnEdit) ||
                        (target === this.pieEdit) ||
                        (target === this.barEdit) ||
                        (target === this.lineEdit);
        if(isCheckBox){
          if(checkNode === this.columnCbx.checkNode){
            checkbox = this.columnCbx;
            editDiv = this.columnEdit;
            tooltipDialog = this.columnTTD;
          }
          else if(checkNode === this.pieCbx.checkNode){
            checkbox = this.pieCbx;
            editDiv = this.pieEdit;
            tooltipDialog = this.pieTTD;
          }
          else if(checkNode === this.barCbx.checkNode){
            checkbox = this.barCbx;
            editDiv = this.barEdit;
            tooltipDialog = this.barTTD;
          }
          else if(checkNode === this.lineCbx.checkNode){
            checkbox = this.lineCbx;
            editDiv = this.lineEdit;
            tooltipDialog = this.lineTTD;
          }
          isOpendNow = !!tooltipDialog.isOpendNow;
          this._hideAllParamsTooltipDialogs();

          if(checkbox.checked){
            this._showEditDiv(editDiv);
            html.addClass(editDiv, 'selected');
            this._showTooltipDialog(tooltipDialog, editDiv);
          }
          else{
            this._hideTooltipDialog(tooltipDialog);
            this._hideEditDiv(editDiv);
          }
        }
        else if(isEditDiv){
          editDiv = target;
          if(editDiv === this.columnEdit){
            tooltipDialog = this.columnTTD;
          }
          else if(editDiv === this.pieEdit){
            tooltipDialog = this.pieTTD;
          }
          else if(editDiv === this.barEdit){
            tooltipDialog = this.barTTD;
          }
          else if(editDiv === this.lineEdit){
            tooltipDialog = this.lineTTD;
          }
          isOpendNow = !!tooltipDialog.isOpendNow;
          this._hideAllParamsTooltipDialogs();
          if(isOpendNow){
            this._hideTooltipDialog(tooltipDialog);
          }
          else{
            this._showTooltipDialog(tooltipDialog, editDiv);
            html.addClass(editDiv, 'selected');
          }
        }
        else{
          if(this.columnTTD.isOpendNow){
            editDiv = this.columnEdit;
            tooltipDialog = this.columnTTD;
          }
          else if(this.pieTTD.isOpendNow){
            editDiv = this.pieEdit;
            tooltipDialog = this.pieTTD;
          }
          else if(this.barTTD.isOpendNow){
            editDiv = this.barEdit;
            tooltipDialog = this.barTTD;
          }
          else if(this.lineTTD.isOpendNow){
            editDiv = this.lineEdit;
            tooltipDialog = this.lineTTD;
          }
          if(tooltipDialog){
            var a = target === tooltipDialog.domNode;
            var b = html.isDescendant(target, tooltipDialog.domNode);
            var isClickInternal = a || b;
            if(isClickInternal){
              this._hideAllParamsTooltipDialogs();
              this._showTooltipDialog(tooltipDialog, editDiv);
              html.addClass(editDiv, 'selected');
            }
            else{
              this._hideAllParamsTooltipDialogs();
            }
          }
          else{
            this._hideAllParamsTooltipDialogs();
          }
        }
      })));
    },

    _createParametersDialog: function(cbx, editDiv, parametersDijit){
      /*jshint unused: false*/
      var ttdContent = html.create('div');
      parametersDijit.placeAt(ttdContent);
      var tooltipDialog = new TooltipDialog({
        content: ttdContent
      });

      return tooltipDialog;
    },

    _unselectEditDivs: function(){
      html.removeClass(this.columnEdit, 'selected');
      html.removeClass(this.pieEdit, 'selected');
      html.removeClass(this.barEdit, 'selected');
      html.removeClass(this.lineEdit, 'selected');
    },

    _showEditDiv: function(editDiv){
      html.setStyle(editDiv, 'display', 'inline-block');
    },

    _hideEditDiv: function(editDiv){
      html.setStyle(editDiv, 'display', 'none');
    },

    _initPreview: function(){
      this.preview = new StatisticsChart({
        map: null,
        isBigPreview: false,
        showSettingIcon: false,
        showZoomIcon: false,
        zoomToFeaturesWhenClick: false
      });

      this.preview.placeAt(this.previewDiv);
      this.preview.startup();
    },

    _updateUIByMode: function(mode){
      //feature,category,count,field
      var chartMode = mode || this.chartModeSelect.get('value') || '';

      var className = chartMode + '-tr';
      var trs = query('.detail-tr', this.detailsTable);

      array.forEach(trs, lang.hitch(this, function(tr){
        if(html.hasClass(tr, className)){
          html.addClass(tr, 'show-tr');
        }
        else{
          html.removeClass(tr, 'show-tr');
        }
      }));

      this._updateChartTypes();
      this._updateParametersDijit();
      if(this.sortDijit){
        this.sortDijit.reset();
        this._updateSortFields();
      }
    },

    _onChartModeChanged: function(){
      if(this.ignoreChangeEvents){
        return;
      }
      var chartMode = this.chartModeSelect.get('value') || '';
      this._updateUIByMode(chartMode);
    },

    _updateSortFields:function(){
      var mode = this.chartModeSelect.get('value');
      if(!this.sortDijit){
        return;
      }
      if(mode === 'count' || mode === 'field'){
        this.sortDijit.setFieldOptions();
        return;
      }
      var sortFieldOptions = this._generateSortFieldOption(mode);
      this.sortDijit.setFieldOptions(sortFieldOptions);
    },

    _generateSortFieldOption: function() {
      var fields = this.valueFields.getSelectedFieldNames();
      if (!fields || fields.length <= 1) {
        return;
      }
      return fields.map(function(field) {
        var alias = utils.getAliasByFieldName(field, this._layerDefinition);
        return {
          label: alias,
          value: field
        };
      }.bind(this));
    },

    _updateChartModeOfChartParamters: function(mode) {
      if (!mode) {
        return;
      }
      if (this.columnParameters) {
        this.columnParameters._updateLegendDisplayByMode(mode);
      }
      if (this.pieParameters) {
        this.pieParameters._updateLegendDisplayByMode(mode);
      }
      if (this.barParameters) {
        this.barParameters._updateLegendDisplayByMode(mode);
      }
      if (this.lineParameters) {
        this.lineParameters._updateLegendDisplayByMode(mode);
      }
    },

    _onChartNameBlurred: function(){
      var value = jimuUtils.stripHTML(this.chartNameTextBox.get('value'));
      this.chartNameTextBox.set('value', value);
    },

    _onChartNameChanged: function(){
      this.emit('name-change', this.chartNameTextBox.get('value'));
    },

    _onDescriptionBlurred: function(){
      this.descriptionTA.value = jimuUtils.stripHTML(this.descriptionTA.value);
    },

    _clear: function(){
      //reset general
      this._layerDefinition = null;
      this.urlTextBox.set('value', '');
      this.filter.reset();

      this.chartNameTextBox.set('value', '');

      this.descriptionTA.value = '';

      this.chartModeSelect.removeOption(this.chartModeSelect.getOptions());

      //reset details
      this.categoryFieldSelect.removeOption(this.categoryFieldSelect.getOptions());

      this.categoryOperationSelect.set('value', 'sum');

      this.fieldOperationSelect.set('value', 'sum');

      this.valueFields.clear();

      this.featureAxisLabelSelect.removeOption(this.featureAxisLabelSelect.getOptions());


      this.columnCbx.setValue(false);
      this.pieCbx.setValue(false);
      this.barCbx.setValue(false);
      this.lineCbx.setValue(false);

      this.columnParameters.reset();
      this.pieParameters.reset();
      this.barParameters.reset();
      this.lineParameters.reset();

      //reset symbol picker
      this.symbolPicker.reset();
      this.colorPicker.setColor(new Color(this._highLightColor));
      //reset sort
      this.sortDijit.reset(true);
      //reset preview
      this.preview.clear();
    },

    _onBtnSetClicked: function(){
      var args = {
        titleLabel: this.nls.setDataSource,

        dijitArgs: {
          multiple: false,
          createMapResponse: this.map.webMapResponse,
          portalUrl: this.appConfig.portalUrl,
          style: {
            height: '100%'
          }
        }
      };

      var featurePopup = new _FeaturelayerSourcePopup(args);
      this.own(on(featurePopup, 'ok', lang.hitch(this, function(item){
        //{name, url, definition}
        var layerSourceType = featurePopup.getSelectedRadioType();
        featurePopup.close();
        featurePopup = null;
        var chartName = null;
        // var expr = null;
        // if(layerSourceType === 'map'){
        //   var layerObject = item.layerInfo && item.layerInfo.layerObject;
        //   if(layerObject && typeof layerObject.getDefinitionExpression === 'function'){
        //     expr = layerObject.getDefinitionExpression();
        //   }
        // }
        var layerId = item.layerInfo && item.layerInfo.id;
        var url = item.url;
        this.showBigShelter();
        utils.getLayerDefinitionByLayerIdOrUrl(layerId, url).then(function(definition){
          this.hideBigShelter();
          item.definition = null;
          item.definition = definition;
          this.setNewLayerDefinition(item, layerSourceType, chartName);
        }.bind(this),function(err){
          console.error(err);
          this.hideBigShelter();
        }.bind(this));
      })));
      this.own(on(featurePopup, 'cancel', lang.hitch(this, function(){
        featurePopup.close();
        featurePopup = null;
      })));

      featurePopup.startup();
    },

    _hasNumberFields: function(layerDefinition){
      var result = false;
      var fieldInfos = layerDefinition.fields;
      if(fieldInfos && fieldInfos.length > 0){
        result = array.some(fieldInfos, lang.hitch(this, function(fieldInfo){
          return this._numberFieldTypes.indexOf(fieldInfo.type) >= 0;
        }));
      }
      return result;
    },

    //update UI by updating data source
    setNewLayerDefinition: function(layerSourceItem, sourceType, /*optional*/ chartName){
      //layerSourceItem: {name,url,definition,...}
      layerSourceItem.definition.name = layerSourceItem.name;
      layerSourceItem.definition.url = layerSourceItem.url;
      var oldUrl = this._layerDefinition && this._layerDefinition.url;
      if (layerSourceItem.url !== oldUrl) {
        this._resetByNewLayerDefinition(layerSourceItem, sourceType, chartName);
      }
    },

    //update UI by updating data source
    _resetByNewLayerDefinition: function(sourceItem, sourceType, /*optional*/ chartName){
      var definition = sourceItem.definition;
      this._addAliasForLayerInfo(definition);
      this._clear();
      if(!definition){
        return;
      }

      var webMapLayerId = null;
      if(sourceType === 'map'){
        if(sourceItem.layerInfo){
          webMapLayerId = sourceItem.layerInfo.id;
        }
      }

      //general
      this._layerDefinition = definition;
      this._webMapLayerId = webMapLayerId;
      var url = definition.url;
      this.urlTextBox.set('value', url);

      //reset filter
      this.filter.reset();
      if(this._layerDefinition){
        var options = {
          featureLayerId: this._webMapLayerId,
          url: url,
          partsObj: null,
          layerDefinition: this._layerDefinition
        };
        this.filter.build(options);
      }

      this.chartNameTextBox.set('value', chartName || definition.name);

      //details
      //reset categoryFieldSelect, featureAxisLabelSelect, valueFields
      this._resetFieldsDijitsByLayerInfo(this._layerDefinition);

      //reset symbol
      var geoType = jimuUtils.getTypeByGeometryType(definition.geometryType);
      var symType = '';
      if(geoType === 'point'){
        symType = 'marker';
      }
      else if(geoType === 'polyline'){
        symType = 'line';
      }
      else if(geoType === 'polygon'){
        symType = 'fill';
      }
      if(symType){
        this.symbolPicker.showByType(symType);
      }
    },

    _resetFieldsDijitsByLayerInfo: function(layerDefinition){
      //reset chartModeSelect
      this.chartModeSelect.removeOption(this.chartModeSelect.getOptions());
      if(this._hasNumberFields(layerDefinition)){
        this.chartModeSelect.addOption({
          value: 'feature',
          label: this.nls.featureOption
        });
        this.chartModeSelect.addOption({
          value: 'category',
          label: this.nls.categoryOption
        });
        this.chartModeSelect.addOption({
          value: 'count',
          label: this.nls.countOption
        });
        this.chartModeSelect.addOption({
          value: 'field',
          label: this.nls.fieldOption
        });
        this.chartModeSelect.set('value', 'feature');
      }
      else{
        this.chartModeSelect.addOption({
          value: 'count',
          label: this.nls.countOption
        });
        this.chartModeSelect.set('value', 'count');
      }

      var displayField = layerDefinition.displayField;
      var fieldInfos = lang.clone(layerDefinition.fields);

      //categoryFieldSelect
      var categoryFieldTypes = [this._stringFieldType, this._dateFieldType];
      categoryFieldTypes = categoryFieldTypes.concat(lang.clone(this._numberFieldTypes));

      var availableCategoryFieldInfos = array.filter(fieldInfos,
        lang.hitch(this, function(fieldInfo){
        return categoryFieldTypes.indexOf(fieldInfo.type) >= 0;
      }));

      this.categoryFieldSelect.removeOption(this.categoryFieldSelect.getOptions());

      var selectedCategoryFieldValue = '';

      array.forEach(availableCategoryFieldInfos, lang.hitch(this, function(fieldInfo){
        var option = {
          value: fieldInfo.name,
          label: fieldInfo.alias || fieldInfo.name
        };

        this.categoryFieldSelect.addOption(option);

        if(fieldInfo.name === displayField){
          selectedCategoryFieldValue = displayField;
        }
      }));

      this.categoryFieldSelect.set('value', selectedCategoryFieldValue);

      //featureAxisLabelSelect
      var a = this._stringFieldType;
      var b = this._oidFieldType;
      var c = this._dateFieldType;
      var featureLabelFieldTypes = [a, b, c].concat(lang.clone(this._numberFieldTypes));

      var availableLabelFieldInfos = array.filter(fieldInfos, lang.hitch(this, function(fieldInfo){
        return featureLabelFieldTypes.indexOf(fieldInfo.type) >= 0;
      }));

      this.featureAxisLabelSelect.removeOption(this.featureAxisLabelSelect.getOptions());

      var selectedAxisLabelValue = '';

      array.forEach(availableLabelFieldInfos, lang.hitch(this, function(fieldInfo){
        var option = {
          value: fieldInfo.name,
          label: fieldInfo.alias || fieldInfo.name
        };

        if(displayField){
          if(fieldInfo.name === displayField){
            selectedAxisLabelValue = fieldInfo.name;
          }
        }
        else{
          if(fieldInfo.type === this._oidFieldType){
            selectedAxisLabelValue = fieldInfo.name;
          }
        }

        this.featureAxisLabelSelect.addOption(option);
      }));

      this.featureAxisLabelSelect.set('value', selectedAxisLabelValue);

      //valueFields
      var numberFieldInfos = array.filter(fieldInfos, lang.hitch(this, function(fieldInfo){
        return this._numberFieldTypes.indexOf(fieldInfo.type) >= 0;
      }));
      this.valueFields.setFields(numberFieldInfos);
    },

    _addAliasForLayerInfo: function(layerInfo){
      if(layerInfo && layerInfo.fields && layerInfo.fields.length > 0){
        array.forEach(layerInfo.fields, lang.hitch(this, function(fieldInfo){
          if(fieldInfo.name && !fieldInfo.alias){
            fieldInfo.alias = fieldInfo.name;
          }
        }));
      }
    },

    _ignoreEvent: function() {
      this.ignoreChangeEvents = true;
    },

    _careEvent: function() {
      setTimeout(function() {
        this.ignoreChangeEvents = false;
      }.bind(this), 200);
    },

    //restore UI when reopen setting page
    _resetByConfig: function(cfg, layerInfo){
      this._ignoreEvent();
      this._addAliasForLayerInfo(layerInfo);
      this._clear();
      var config = lang.clone(cfg);

      //general
      this._layerDefinition = layerInfo;
      this._webMapLayerId = config.webMapLayerId;
      this.urlTextBox.set('value', config.url);
      var filter = config.filter;
      // this.whereClause.innerHTML = filter.expr;
      var options = {
        featureLayerId: this._webMapLayerId,
        url: config.url,
        partsObj: filter,
        layerDefinition: this._layerDefinition
      };
      this.filter.build(options);
      this.chartNameTextBox.set('value', config.name || layerInfo.name || '');
      this.descriptionTA.value = config.description || '';

      //details
      //reset categoryFieldSelect, featureAxisLabelSelect, valueFields
      this._resetFieldsDijitsByLayerInfo(layerInfo);

      this.chartModeSelect.set('value', config.mode);

      var setPieConfig = lang.hitch(this, function(){
        var pieDisplayConfig = this._getChartTypeDisplayConfig(config, 'pie');
        if(pieDisplayConfig){
          this.pieParameters.setConfig(pieDisplayConfig);
          this.pieCbx.setValue(true);
          this._showEditDiv(this.pieEdit);
        }
      });

      if(config.mode === 'feature'){
        this.featureAxisLabelSelect.set('value', config.labelField);
        this.valueFields.selectFields(config.valueFields);

        if(config.valueFields.length <= 1){
          setPieConfig();
        }
      }else if(config.mode === 'category'){
        this.categoryFieldSelect.set('value', config.categoryField);
        this.categoryOperationSelect.set('value', config.operation);
        this.valueFields.selectFields(config.valueFields);

        if(config.valueFields.length <= 1){
          setPieConfig();
        }
      }else if(config.mode === 'count'){
        this.categoryFieldSelect.set('value', config.categoryField);

        setPieConfig();
      }else if(config.mode === 'field'){
        this.fieldOperationSelect.set('value', config.operation);
        this.valueFields.selectFields(config.valueFields);
        setPieConfig();
      }

      //should execute setConfig method of Parameters after execute setConfig method of valueFields
      var columnDisplayConfig = this._getChartTypeDisplayConfig(config, 'column');
      if(columnDisplayConfig){
        this.columnParameters.setConfig(columnDisplayConfig);
        this.columnCbx.setValue(true);
        this._showEditDiv(this.columnEdit);
      }

      var barDisplayConfig = this._getChartTypeDisplayConfig(config, 'bar');
      if(barDisplayConfig){
        this.barParameters.setConfig(barDisplayConfig);
        this.barCbx.setValue(true);
        this._showEditDiv(this.barEdit);
      }

      var lineDisplayConfig = this._getChartTypeDisplayConfig(config, 'line');
      if(lineDisplayConfig){
        this.lineParameters.setConfig(lineDisplayConfig);
        this.lineCbx.setValue(true);
        this._showEditDiv(this.lineEdit);
      }
      //sort order
      if(config.sortOrder){
        this.sortDijit.setConfig(config.sortOrder);
      }
      //set symbol
      var symbol = esriSymbolJsonUtils.fromJson(config.symbol);
      this.symbolPicker.showBySymbol(symbol);

      //highlight color
      this.colorPicker.setColor(new Color(config.highLightColor));
      this._careEvent();
    },

    _getChartTypeDisplayConfig: function(widgetConfig, chartType){
      if(widgetConfig && widgetConfig.types && widgetConfig.types.length > 0){
        for(var i = 0; i < widgetConfig.types.length; i++){
          if(widgetConfig.types[i].type === chartType){
            return widgetConfig.types[i].display;
          }
        }
      }
      return null;
    },

    _updatePreview: function(){
      this.preview.clear();
      var config = this.getConfig(true);
      if(!config){
        return;
      }

      var queryParams = new EsriQuery();
      queryParams.returnGeometry = false;
      queryParams.where = config.filter.expr || '1=1';
      queryParams.outFields = [];

      if(config.mode === 'feature'){
        queryParams.outFields = lang.clone(config.valueFields);
        if(queryParams.outFields.indexOf(config.labelField) < 0){
          queryParams.outFields = [config.labelField].concat(queryParams.outFields);
        }
      }
      else if(config.mode === 'category'){
        queryParams.outFields = lang.clone(config.valueFields);
        if(queryParams.outFields.indexOf(config.categoryField) < 0) {
          queryParams.outFields =  [config.categoryField].concat(queryParams.outFields);
        }
      }
      else if(config.mode === 'count'){
        queryParams.outFields = [config.categoryField];
      }
      else if(config.mode === 'field'){
        queryParams.outFields = lang.clone(config.valueFields);
      }

      this.tab.showShelter();
      this.showBigShelter();

      this._queryFeatures(queryParams, config.url).then(lang.hitch(this, function(features) {
        if(!this.domNode){
          return;
        }

        var box = html.getContentBox(this.domNode.parentNode);
        var h = Math.max(box.h - 60, 150);
        html.setStyle(this.preview.domNode, 'height', h + 'px');

        // var args = {
        //   config: config,
        //   features: features,
        //   layerDefinition: this._layerDefinition,
        //   resultLayer: null
        // };
        // this.preview.createClientCharts(args);
        features = features.slice(0, this.maxPreviewFeaturesCount);
        var url = this._layerDefinition.url;
        this.preview.createClientCharts(url, features, config);
        this.tab.hideShelter();
        this.hideBigShelter();
      }), lang.hitch(this, function(err) {
        if(!this.domNode){
          return;
        }

        console.error(err);
        this.tab.hideShelter();
        this.hideBigShelter();
      }));
    },

    _queryFeatures: function(queryParams, url){
      var def = new Deferred();
      var queryTask = new QueryTask(url);
      queryTask.execute(queryParams).then(lang.hitch(this, function(featureSet){
        var features = featureSet.features || [];
        def.resolve(features);
      }), lang.hitch(this, function(err){
        //maybe a joined layer
        if(err && err.code === 400){
          queryParams.outFields = ["*"];
          var queryTask2 = new QueryTask(url);
          queryTask2.execute(queryParams).then(lang.hitch(this, function(featureSet2){
            def.resolve(featureSet2);
          }), lang.hitch(this, function(err2){
            def.reject(err2);
          }));
        }else{
          def.reject(err);
        }
      }));
      return def;
    }

  });
});